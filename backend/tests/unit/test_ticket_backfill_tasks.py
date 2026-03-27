from unittest.mock import patch


@patch("app.tasks.ticket_tasks.logger")
@patch("app.tasks.ticket_tasks.run_async")
def test_backfill_missing_personal_tickets_task_runs_helper(mock_run_async, mock_logger):
    from app.tasks.ticket_tasks import backfill_missing_personal_tickets_task

    backfill_missing_personal_tickets_task()

    mock_run_async.assert_called_once()
    mock_logger.exception.assert_not_called()


@patch("app.tasks.ticket_tasks.logger")
@patch("app.tasks.ticket_tasks.run_async")
def test_backfill_missing_personal_tickets_task_logs_failures(mock_run_async, mock_logger):
    from app.tasks.ticket_tasks import backfill_missing_personal_tickets_task

    mock_run_async.side_effect = RuntimeError("worker failed")

    backfill_missing_personal_tickets_task()

    mock_logger.exception.assert_called_once()
