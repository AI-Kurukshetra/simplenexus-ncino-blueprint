alter type public.appointment_event_type add value if not exists 'visit_started';
alter type public.appointment_event_type add value if not exists 'visit_note_added';
alter type public.appointment_event_type add value if not exists 'visit_completed';
