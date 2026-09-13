-- Processing state is controlled by the worker and trusted server actions.
-- Users can read their own progress but cannot forge completion, draft IDs,
-- retries, or failure state from the browser.

drop policy if exists processing_jobs_insert_own on public.processing_jobs;
drop policy if exists processing_jobs_update_own on public.processing_jobs;
drop policy if exists processing_jobs_delete_own on public.processing_jobs;
