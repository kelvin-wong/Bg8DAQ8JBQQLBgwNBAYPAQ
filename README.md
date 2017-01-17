# Bg8DAQ8JBQQLBgwNBAYPAQ
Technical challenge - nodejs worker with beanstalkd backend

## Goal
----
Code a currency exchagne rate `worker`

1. Input currency `FROM` and `TO`, say USD to HKD, one currency conversation per job.
2. Get `FROM` and `TO` currency every 1 min, save 10 successful rate results to mongodb include the timestamp, then that currency converstaion job is done.
3. If any problem during the get rate attempt, retry it delay with 3s
4. If failed more than 3 times in total (not consecutive), bury the job.

## How it work?
---

1. Seed your job in beanstalkd

```
npm run seed
```

##### Sample beanstalk payload for getting HKD to USD currency
```
{
  "from": "HKD",
  "to": "USD"
}
```

2. Start a nodejs worker, get the job from beanstalkd, get the data from xe.com and save it to mongodb. Exchange rate need to be round off to `2` decmicals in `STRING` type.

	a. If request is failed, reput to the tube and delay with 3s.

	b. If request is succeed, reput to the tube and delay with 60s.

```
npm run worker
```

##### mongodb data:
```
{
	"from": "HKD",
	"to": "USD",
	"created_at": new Date(1347772624825),
	"rate": "0.13"
}

```

3. Stop the task if it tried 10 succeed attempts or 3 failed attempts in total

## Testing
---
Run the tests
```
npm run test
```
