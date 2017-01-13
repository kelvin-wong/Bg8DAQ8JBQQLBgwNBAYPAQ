'use strict';

const config = require('./config');
const fivebeans = require('fivebeans');

let client = new fivebeans.client(config.bs.host, config.bs.port);

function putJob() {
	let payload = {
		'from': 'HKD',
		'to': 'USD'
	};
	client.put(config.job.priority, 0, config.job.ttr, JSON.stringify(payload), function (err, job_id) {
	});
}

client
	.on('connect', function () {
		console.log('client connected');
		client.use(config.bs.tube, function (e, tube_name) {
			client.watch(tube_name, function (err, num_watched) {
				if (err) {
					console.log('Watch tube (' + config.bs.tube + ') error: ' + err);
				} else {
					putJob();
					client.end();
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
