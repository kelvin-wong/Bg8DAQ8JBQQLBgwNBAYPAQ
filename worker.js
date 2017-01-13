'use strict';

const config = require('./config');
const fivebeans = require('fivebeans');
const co = require('co');
const Promise = require('bluebird');

const request = Promise.promisify(require('request'));
const MongoClient = require('mongodb').MongoClient;

let client = new fivebeans.client(config.bs.host, config.bs.port);
let success_count = 0;
let fail_count = 0;


function doJob() {
	client.reserve(function (err, job_id, payload) {
		console.log('Reserve job ' + job_id);
		if (err) {
			console.log('Reserve job ' + job_id + ' error:');
			console.log(err);
		} else {
			getExchangeRate(job_id, payload.toString());
		}
	});
}

function nextJob(job_id, payload) {
	success_count++;
	client.destroy(job_id, config.bs.priority, function (err) {
		if (err) {
			console.log('Destroy job' + job_id + ' error:');
			console.log(err);
		} else if (success_count < 10) {
			client.put(config.job.priority, config.job.delay, config.job.ttr, JSON.stringify(payload), function (e, j_id) {
				doJob();
			});
		} else {
			console.log('All done!');
			client.end();
		}
	});
}

function retryJob(job_id, payload) {
	if (fail_count < 3) {
		console.log('Job ' + job_id + ' failed');
		fail_count++;
		client.destroy(job_id, config.bs.priority, function (err) {
			client.put(config.job.priority, config.job.retry_delay, config.job.ttr, JSON.stringify(payload), function (e, j_id) {
				doJob();
			});
		});
	} else {
		client.bury(job_id, config.job.priority, function (err) {
			if (err) {
				console.log('Bury job ' + job_id + ' error:');
				console.log(err);
			}
			console.log('Failed 3 times!');
			client.end();
		});
	}
}

function getExchangeRate(job_id, payload) {
	let data = JSON.parse(payload);
	request({
		url: 'http://www.xe.com/currencyconverter/convert/',
		qs: {'Amount': 1, 'From': data.from, 'To': data.to}
	}).then(function (response) {
		if (response.statusCode === 200) {
			let elm = response.body.match(/<span class='uccResultAmount'>([\d.]*)<\/span>/g);
			if (elm) {
				let rate = Number.parseFloat(elm[0].match(/[\d.]+/g)[0]).toFixed(2);
				saveExchangeRate({
					'from': data.from,
					'to': data.to,
					'rate': rate
				}).then(function (success) {
					nextJob(job_id, data);
				}).catch(function (err) {
					retryJob(job_id, data);
				});
			} else {
				retryJob(job_id, data);
			}
		} else {
			retryJob(job_id, data);
		}
	}).catch(function (err) {
		console.log(err);
		retryJob(job_id, data);
	});
}

let saveExchangeRate = co.wrap(function* (data) {
	let db = yield MongoClient.connect(config.mongo.url);
	let r = yield db.collection(config.mongo.collection).insertOne({
		'from': data.from,
		'to': data.to,
		'created_at': new Date(),
		'rate': data.rate
	});
	db.close();
	return r;
});

client
	.on('connect', function () {
		console.log('client connected');
		client.use(config.bs.tube, function (e, tube_name) {
			client.watch(tube_name, function (err, num_watched) {
				if (err) {
					console.log('Watch tube (' + config.bs.tube + ') error: ' + err);
				} else {
					doJob();
				}
			});
		});
	})
	.on('error', function (err) {
		console.log(err);
	})
	.on('close', function () {
		console.log('client closed');
	})
	.connect();
