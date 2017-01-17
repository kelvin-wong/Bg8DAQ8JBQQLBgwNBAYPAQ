'use strict';
const worker = require('./worker.js');
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const bluebird = require('bluebird');
const proxyquire = require('proxyquire');

let payload = {'from': 'HKD', 'to': 'USD'};

describe('Exchange rate worker', function () {

	it('should get the job from beanstalkd', function () {
		let reserve = sinon.stub(worker.client, 'reserve');
		let getExchangeRate = sinon.stub(worker, 'getExchangeRate');
		reserve.yields(null, 1, new Buffer(JSON.stringify(payload)));
		worker.doJob(getExchangeRate);
		expect(getExchangeRate.called).to.be.equal(true);
		getExchangeRate.restore();
		reserve.restore();
	});

	it('should get next job', function () {
		let destroy = sinon.stub(worker.client, 'destroy');
		let checkSuccess = sinon.stub(worker, 'checkSuccess');
		destroy.yields(null);
		worker.nextJob(1, checkSuccess);
		expect(destroy.called).to.be.equal(true);
		expect(checkSuccess.called).to.be.equal(true);
		destroy.restore();
		checkSuccess.restore();
	});

	it('should be done', function () {
		let end = sinon.stub(worker.client, 'end');
		let destroy = sinon.stub(worker.client, 'destroy');
		let put = sinon.stub(worker.client, 'put');
		destroy.yields(null);
		for (let i = 0; i < 10; i++) {
			worker.nextJob(1, worker.checkSuccess);
		}
		expect(destroy.callCount).to.be.equal(10);
		expect(end.called).to.be.true;
		end.restore();
		destroy.restore();
		put.restore();
	});

	it('should get the request result', function () {
		let req = sinon.stub(worker.request, 'get');
		let response = {
			statusCode: 200,
			body: '<span class="uccAmountWrap"><span class="uccFromResultAmount" style="width: 116px;"><span class="amount" data-amount="1">1</span>&nbsp;HKD =</span><span class=\'uccResultAmount\'>0.128951</span><span class="uccToCurrencyCode" style="width: 116px;">USD</span></span>'
		};
		req.returns(bluebird.resolve(response));
		worker.getExchangeRate(1);
		expect(req.called).to.be.true;
		req.restore();
	});
	it('should fail to get the request result', function () {
		let req = sinon.stub(worker.request, 'get');	
		let response = {
			statusCode: 400,
			body: ''
		};
		req.returns(bluebird.resolve(response));
		worker.getExchangeRate(1);
		expect(req.called).to.be.true;
		req.restore();
	});

});
