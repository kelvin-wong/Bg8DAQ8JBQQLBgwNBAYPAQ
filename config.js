'use strict';

let config = {
	job: {
		delay: 60,
		retry_delay: 3,
		priority: 0,
		ttr: 60
	},
	bs: {
		host: 'challenge.aftership.net',
		port: 11300,
		tube: 'kelvin-wong'
	},
	mongo: {
		url: 'mongodb://kelvin:kelvinwong@ds161048.mlab.com:61048/conversion-rate',
		collection: 'rates'
	}
};

module.exports = config;
