'use strict';

const config = require('./config');
const fivebeans = require('fivebeans');
const co = require('co');
const bluebird = require('bluebird');

const request = bluebird.promisify(require('request'));
const MongoClient = require('mongodb').MongoClient;

let client = new fivebeans.client(config.bs.host, config.bs.port);
let success_count = 0;
let fail_count = 0;
let payload_data;


function doJob(callback) {
	client.reserve(function (err, job_id, payload) {
		console.log('Reserve job ' + job_id);
		if (err) {
			console.log('Reserve job ' + job_id + ' error:');
			console.log(err);
		} else {
			payload_data = JSON.parse(payload.toString());
			callback(job_id);
		}
	});
}

function nextJob(job_id, callback) {
	success_count++;
	client.destroy(job_id, config.bs.priority, callback);
}

function checkSuccess() {
	if (success_count < 10) {
		createJob(config.job.priority, config.job.delay, config.job.ttr, JSON.stringify(payload_data));
	} else {
		console.log('All done!');
		client.end();
	}
}

function createJob(priority, delay, ttr, payload) {
	client.put(priority, delay, ttr, payload, function (err, job_id) {
		doJob(getExchangeRate);
	});
}

function retryJob(job_id, callback) {
	fail_count++;
	if (fail_count < 3) {
		console.log('Job ' + job_id + ' failed');
		client.destroy(job_id, config.bs.priority, callback);
	} else {
		buryJob(job_id);
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

function createRetryJob() {
	createJob(config.job.priority, config.job.retry_delay, config.job.ttr, JSON.stringify(payload_data));
}

function buryJob(job_id) {
	client.bury(job_id, config.job.priority, function (error) {
		console.log('Failed 3 times!');
		client.end();
	});
}

function getExchangeRate(job_id) {
	request.get({
		url: 'http://www.xe.com/currencyconverter/convert/',
		qs: {'Amount': 1, 'From': payload_data.from, 'To': payload_data.to}
	}).then(function (response) {
		if (response.statusCode === 200) {
			let elm = response.body.match(/<span class='uccResultAmount'>([\d.]*)<\/span>/g);
			if (elm) {
				let rate = Number.parseFloat(elm[0].match(/[\d.]+/g)[0]).toFixed(2);
				saveExchangeRate({
					'from': payload_data.from,
					'to': payload_data.to,
					'rate': rate
				}).then(function (success) {
					nextJob(job_id, checkSuccess);
				}).catch(function (err) {
					retryJob(job_id, createRetryJob);
				});
			} else {
				retryJob(job_id, createRetryJob);
			}
		} else {
			console.log(retryJob);
			retryJob(job_id, createRetryJob);
		}
	}).catch(function (err) {
		console.log(err);
		retryJob(job_id, createRetryJob);
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
					doJob(getExchangeRate);
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

module.exports = {
	request: request,
	client: client,
	doJob: doJob,
	nextJob: nextJob,
	createJob: createJob,
	checkSuccess: checkSuccess,
	retryJob: retryJob,
	createRetryJob: createRetryJob,
	getExchangeRate: getExchangeRate,
	saveExchangeRate: saveExchangeRate
}
