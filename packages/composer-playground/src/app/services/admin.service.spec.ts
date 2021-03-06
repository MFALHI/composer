/* tslint:disable:no-unused-variable */
import {TestBed, inject, fakeAsync, tick} from '@angular/core/testing';
import {AdminService} from './admin.service';

import * as sinon from 'sinon';
import * as chai from 'chai';

let should = chai.should();

import {AlertService} from './alert.service';
import {BusinessNetworkDefinition} from 'composer-common';
import {ConnectionProfileService} from './connectionprofile.service';
import {IdentityService} from '../identity.service';
import {AdminConnection} from 'composer-admin';

describe('AdminService', () => {

  let alertMock = sinon.createStubInstance(AlertService);
  let connectionProfileMock = sinon.createStubInstance(ConnectionProfileService);
  let businessNetworkDefMock = sinon.createStubInstance(BusinessNetworkDefinition);
  let identityMock = sinon.createStubInstance(IdentityService);

  let adminConnectionMock = sinon.createStubInstance(AdminConnection);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AdminService,
        {provide: AlertService, useValue: alertMock},
        {provide: ConnectionProfileService, useValue: connectionProfileMock},
        {provide: IdentityService, useValue: identityMock}]
    });
  });

  describe('getAdminConnection', () => {
    it('should get the admin connection if it exists', inject([AdminService], (service: AdminService) => {
      service['adminConnection'] = adminConnectionMock;

      let result = service.getAdminConnection();

      result.should.deep.equal(adminConnectionMock);
    }))
  });

  describe('ensureConnected', () => {
    it('should return if connected', inject([AdminService], (service: AdminService) => {
      service['isConnected'] = true;

      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      service.ensureConnected();

      alertMock.busyStatus$.next.should.not.have.been.called;
    }));

    it('should return if connecting', inject([AdminService], (service: AdminService) => {
      service['connectingPromise'] = Promise.resolve();

      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      service.ensureConnected();

      alertMock.busyStatus$.next.should.not.have.been.called;
    }));

    it('should connect if not connected', fakeAsync(inject([AdminService], (service: AdminService) => {
      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let connectMock = sinon.stub(service, 'connect').returns(Promise.resolve());
      service.ensureConnected();

      tick();

      alertMock.busyStatus$.next.should.have.been.calledWith('Establishing admin connection ...');

      connectMock.should.have.been.called;

      service['isConnected'].should.equal(true);
      should.not.exist(service['connectingPromise']);
    })));

    it('should connect without id if not deployed', fakeAsync(inject([AdminService], (service: AdminService) => {
      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let connectMock = sinon.stub(service, 'connect').returns(Promise.reject('error'));
      let connectWithoutMock = sinon.stub(service, 'connectWithOutID').returns(Promise.resolve());
      service['madeItToConnect'] = true;
      service.ensureConnected();

      tick();

      alertMock.busyStatus$.next.should.have.been.calledWith('Establishing admin connection ...');

      connectMock.should.have.been.called;
      connectWithoutMock.should.have.been.called;

      service['isConnected'].should.equal(true);
      should.not.exist(service['connectingPromise']);
    })));

    it('should connect without id if not deployed and handle error', fakeAsync(inject([AdminService], (service: AdminService) => {
      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let connectMock = sinon.stub(service, 'connect').returns(Promise.reject('error'));
      let connectWithoutMock = sinon.stub(service, 'connectWithOutID').returns(Promise.reject('some error'));
      service['madeItToConnect'] = true;
      service.ensureConnected().then(() => {
        throw new Error('should not get here');
      })
        .catch((error) => {
          error.should.equal('some error');
        });

      tick();

      alertMock.busyStatus$.next.should.have.been.calledWith('Establishing admin connection ...');

      connectMock.should.have.been.called;
      connectWithoutMock.should.have.been.called;

      service['isConnected'].should.equal(false);
      should.not.exist(service['connectingPromise']);
    })));


    it('should connect and catch error if not made it to connect', fakeAsync(inject([AdminService], (service: AdminService) => {
      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let connectMock = sinon.stub(service, 'connect').returns(Promise.reject('some error'));
      service['madeItToConnect'] = false;
      service.ensureConnected().then(() => {
        throw new Error('should not have got here');
      })
        .catch((error) => {
          error.should.equal('some error');
        });

      tick();

      alertMock.busyStatus$.next.should.have.been.calledWith('Establishing admin connection ...');
      connectMock.should.have.been.called;
    })));
  });

  describe('connect', () => {
    it('should connect', fakeAsync(inject([AdminService], (service: AdminService) => {
      connectionProfileMock.getCurrentConnectionProfile.returns('my profile');

      let mockGetAdminConnection = sinon.stub(service, 'getAdminConnection').returns(adminConnectionMock);

      identityMock.getUserID.returns(Promise.resolve('myId'));
      identityMock.getUserSecret.returns(Promise.resolve('myPassword'));

      service.connect();

      tick();

      service['userSecret'].should.equal('myPassword');
      service['userID'].should.equal('myId');
      service['madeItToConnect'].should.equal(true);

      adminConnectionMock.connect.should.have.been.calledWith('my profile', 'myId', 'myPassword', 'org.acme.biznet');

    })));
  });

  describe('connectWithOutID', () => {
    it('should connect without an id', fakeAsync(inject([AdminService], (service: AdminService) => {
      let mockGetAdminConnection = sinon.stub(service, 'getAdminConnection').returns(adminConnectionMock);

      adminConnectionMock.connect.returns(Promise.resolve());
      adminConnectionMock.list.returns(Promise.resolve([]));

      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let mockGenerateBusinessNetwork = sinon.stub(service, 'generateDefaultBusinessNetwork').returns({name: 'myNetwork'});

      adminConnectionMock.deploy.returns(Promise.resolve());

      service['userID'] = 'myUser';
      service['userSecret'] = 'mySecret';
      service['connectionProfile'] = 'myProfile';

      service.connectWithOutID();

      tick();

      alertMock.busyStatus$.next.should.have.been.called;
      mockGenerateBusinessNetwork.should.have.been.called;
      adminConnectionMock.deploy.should.have.been.calledWith({name: 'myNetwork'});
      service['initialDeploy'] = true;

      adminConnectionMock.disconnect.should.have.been.called;
      adminConnectionMock.connect.should.have.been.calledWith('myProfile', 'myUser', 'mySecret', 'org.acme.biznet');
    })));

    it('should connect without an id but not deploy as already deployed', fakeAsync(inject([AdminService], (service: AdminService) => {
      let mockGetAdminConnection = sinon.stub(service, 'getAdminConnection').returns(adminConnectionMock);

      adminConnectionMock.connect.returns(Promise.resolve());
      adminConnectionMock.list.returns(Promise.resolve(['org.acme.biznet']));

      alertMock.busyStatus$ = {
        next: sinon.stub()
      };

      let mockGenerateBusinessNetwork = sinon.stub(service, 'generateDefaultBusinessNetwork').returns({name: 'myNetwork'});

      adminConnectionMock.deploy.returns(Promise.resolve());

      service['userID'] = 'myUser';
      service['userSecret'] = 'mySecret';
      service['connectionProfile'] = 'myProfile';

      service.connectWithOutID();

      tick();

      alertMock.busyStatus$.next.should.not.have.been.called;

      adminConnectionMock.disconnect.should.have.been.called;
      adminConnectionMock.connect.should.have.been.calledWith('myProfile', 'myUser', 'mySecret', 'org.acme.biznet');
    })));
  });

  describe('deploy', () => {
    it('should deploy a business network', fakeAsync(inject([AdminService], (service: AdminService) => {
      let connectedMock = sinon.stub(service, 'ensureConnected').returns(Promise.resolve());

      service['adminConnection'] = adminConnectionMock;


      service.deploy(businessNetworkDefMock);

      tick();

      connectedMock.should.have.been.called;
      adminConnectionMock.deploy.should.have.been.calledWith(businessNetworkDefMock);
    })));
  });

  describe('update', () => {
    it('should update a business network', fakeAsync(inject([AdminService], (service: AdminService) => {
      let connectedMock = sinon.stub(service, 'ensureConnected').returns(Promise.resolve());

      service['adminConnection'] = adminConnectionMock;

      service.update(businessNetworkDefMock);

      tick();

      connectedMock.should.have.been.called;
      adminConnectionMock.update.should.have.been.calledWith(businessNetworkDefMock);
    })));
  });

  describe('isInitialDeploy', () => {
    it('should set initial deploy to false after call', inject([AdminService], (service: AdminService) => {
      service['initialDeploy'] = true;

      let result = service.isInitialDeploy();

      service['initialDeploy'].should.equal(false);
    }));
  })
});

