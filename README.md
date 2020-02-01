# melonade-process-manager

Workflow manager that implemented SAGA, written in typescript

## Tasks

- [x] Workflow Definition
- [x] Task Definition
- [x] Workflow Instance
- [x] Task Instance
- [x] State Translation
- [x] Store
- [x] Refacetor code, move to their's domain
- [x] Dispatcher
- [x] Consumer
- [x] Config
- [ ] Logger
- [x] Use custom error
- [x] Clean up completed workflows/tasks
- [x] Delay dispatcher
- [ ] Cron job transaction support
- [x] Failed workflow handling
- [x] Timeout workflow handling
- [x] Cancel workflow
- [x] Event store
- [x] Compensate workflow
- [x] Publish event to kafka
- [x] Update Workflow/Transaction's output
- [x] Time keeper
- [x] Refactor redundant action in "STATE"
- [x] Watch for workflowDefinition changed
- [x] Rewrite all the test XD
- [x] Instance delete retention => clean up when transaction finished
- [ ] Graceful shutdown
- [x] Procress system task immediately intread of dispatch to itself
- [x] Use json schema
- [x] Document
- [x] Remove sub-workflow
- [x] Test parallel task inside another parallel task
- [ ] Standardise the error, so it easilier to summary.
- [ ] List running transaction redis not work correctly (paginates)
- [ ] Pause workflow

## Known issues

- [x] parallel tasks can be empty
- [x] Sub workflow won't get compensate => Not support sub-workflow anymore
- [x] Task/Workflow data send as string's ISO time format instead of number
- [ ] Workflow Definition can have task that not existed
- [x] MongoDB not fast enough for 5000 concurent (Lag about 1 min before task updated) => Added redis store
- [x] Transaction did not cancelled if compensating
- [x] Parent task did not failed if child failed
- [x] Delay retry task sometime did not retry until limit
