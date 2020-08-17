# melonade-process-manager

Workflow manager that implemented SAGA, written in typescript

## To start

```bash
  nvm install v10.16.3
  nvm use

  npm install
  npm run start:watch
```

# Docker .env

```bash
melonade.namespace=docker-compose
runners.max=1
kafka.conf.bootstrap.servers=localhost:29092
server.hostname=0.0.0.0
server.port=8080
server.enabled=true
topic.kafka.number_partitions=10
topic.kafka.replication_factor=1
task-definition.type=ZOOKEEPER
task-definition.zookeeper.connections=localhost:2181
workflow-definition.type=ZOOKEEPER
workflow-definition.zookeeper.connections=localhost:2181
task-instance.type=REDIS
task-instance.redis.host=localhost
task-instance.redis.port=16379
workflow-instance.type=REDIS
workflow-instance.redis.host=localhost
workflow-instance.redis.port=16379
transaction-instance.type=REDIS
transaction-instance.redis.host=localhost
transaction-instance.redis.port=16379
```

## Recomended kafka's brokers config

offsets.topic.replication.factor=3
default.replication.factor=3
min.insync.replicas=2
offsets.retention.minutes=5000000
unclean.leader.election.enable=false
auto.create.topics.enable=false

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
- [ ] Transaction will failed if send cancel transaction while on compensate workflow
