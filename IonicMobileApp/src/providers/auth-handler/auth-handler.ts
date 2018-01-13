/**
 * Copyright 2017 IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference path="../../../plugins/cordova-plugin-mfp/typings/worklight.d.ts" />
/// <reference path="../../../plugins/cordova-plugin-mfp-jsonstore/typings/jsonstore.d.ts" />

import { Injectable } from '@angular/core';

@Injectable()
export class AuthHandlerProvider {
  securityCheckName = 'UserLogin';
  userLoginChallengeHandler;
  initialized = false;
  username = null;

  isChallenged = false;
  handleChallengeCallback = null;
  loginSuccessCallback = null;
  loginFailureCallback = null;

  constructor() {
    console.log('--> AuthHandlerProvider constructor() called');
  }

  // Reference: https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/8.0/authentication-and-security/credentials-validation/javascript/
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    console.log('--> AuthHandler init() called');
    this.userLoginChallengeHandler = WL.Client.createSecurityCheckChallengeHandler(this.securityCheckName);
    // https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
    this.userLoginChallengeHandler.handleChallenge = this.handleChallenge.bind(this);
    this.userLoginChallengeHandler.handleSuccess = this.handleSuccess.bind(this);
    this.userLoginChallengeHandler.handleFailure = this.handleFailure.bind(this);
  }

  setHandleChallengeCallback(onHandleChallenge) {
    console.log('--> AuthHandler setHandleChallengeCallback() called');
    this.handleChallengeCallback = onHandleChallenge;
  }

  setLoginSuccessCallback(onSuccess) {
    console.log('--> AuthHandler setLoginSuccessCallback() called');
    this.loginSuccessCallback = onSuccess;
  }

  setLoginFailureCallback(onFailure) {
    console.log('--> AuthHandler setLoginFailureCallback() called');
    this.loginFailureCallback = onFailure;
  }

  handleChallenge(challenge) {
    console.log('--> AuthHandler handleChallenge called.\n', JSON.stringify(challenge));
    this.isChallenged = true;
    if (challenge.errorMsg !== null && this.loginFailureCallback != null) {
      var statusMsg = 'Remaining attempts = ' + challenge.remainingAttempts + '<br>' + challenge.errorMsg;
      this.loginFailureCallback(statusMsg);
    } else if (this.handleChallengeCallback != null) {
      this.handleChallengeCallback();
    } else {
      console.log('--> AuthHandler: handleChallengeCallback not set!');
    }
  }

  handleSuccess(data) {
    console.log('--> AuthHandler handleSuccess called');
    this.isChallenged = false;
    if (this.loginSuccessCallback != null) {
      this.loginSuccessCallback();
    } else {
      console.log('--> AuthHandler: loginSuccessCallback not set!');
    }
  }

  handleFailure(error) {
    console.log('--> AuthHandler handleFailure called.\n' + JSON.stringify(error));
    this.isChallenged = false;
    if (this.loginFailureCallback != null) {
      this.loginFailureCallback(error.failure);
    } else {
      console.log('--> AuthHandler: loginFailureCallback not set!');
    }
  }

  // Reference: https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/8.0/authentication-and-security/user-authentication/javascript/
  checkIsLoggedIn() {
    console.log('--> AuthHandler checkIsLoggedIn called');
    WLAuthorizationManager.obtainAccessToken('UserLogin')
    .then(
      (accessToken) => {
        console.log('--> AuthHandler: obtainAccessToken onSuccess');
      },
      (error) => {
        console.log('--> AuthHandler: obtainAccessToken onFailure: ' + JSON.stringify(error));
      }
    );
  }

  login(username, password) {
    console.log('--> AuthHandler login called. isChallenged = ', this.isChallenged);
    this.username = username;
    if (this.isChallenged) {
      this.userLoginChallengeHandler.submitChallengeAnswer({'username':username, 'password':password});
    } else {
      // https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
      var self = this;
      WLAuthorizationManager.login(this.securityCheckName, {'username':username, 'password':password})
      .then(
        (success) => {
          console.log('--> AuthHandler: login success');
          this.storeCredentialsInJSONStore(username, password);
        },
        (failure) => {
          console.log('--> AuthHandler: login failure: ' + JSON.stringify(failure));
          self.loginFailureCallback(failure.errorMsg);
        }
      );
    }
  }

  logout() {
    console.log('--> AuthHandler logout called');
    WLAuthorizationManager.logout(this.securityCheckName)
    .then(
      (success) => {
        console.log('--> AuthHandler: logout success');
      },
      (failure) => {
        console.log('--> AuthHandler: logout failure: ' + JSON.stringify(failure));
      }
    );
  }

  collectionName = 'userCredentials';
  collections = {
    userCredentials: {
      searchFields: {username: 'string'}
    }
  }

  storeCredentialsInJSONStore(username, password) {
    console.log('--> AuthHandler: storeCredentialsInJSONStore called');

    WL.SecurityUtils.base64Encode(username).then((res) => {
      // base64EncodedUsername = res;
    });
    let authData = {
      username: username, // base64EncodedUsername,
      password: password,
      localKeyGen: true
    }

    // https://www.ibm.com/support/knowledgecenter/en/SSHS8R_8.0.0/com.ibm.worklight.apiref.doc/html/refjavascript-client/html/WL.JSONStore.html
    WL.JSONStore.closeAll({});
    WL.JSONStore.init(this.collections, authData).then((success) => {
      WL.JSONStore.get(this.collectionName).count({}, {}).then((countResult) => {
        if (countResult == 0) {
          // The JSONStore collection is empty, populate it.
          WL.JSONStore.get(this.collectionName).add(authData, {});
          console.log('--> AuthHandler: JSONStore collection has been populated with user-credentials for user: ', username);
        }
      })
    },(failure) => {
      console.log('--> AuthHandler: Password change detected for user: ' + username + ' . Destroying old JSONStore so as to recreate it\n', JSON.stringify(failure));
      WL.JSONStore.destroy(username).then(() => {
        this.storeCredentialsInJSONStore(username, password);
      });
    })
  }

  offlineLogin(username, password) {
    console.log('--> AuthHandler: offlineLogin called');

    WL.SecurityUtils.base64Encode(username).then((res) => {
      // base64EncodedUsername = res;
    });
    let authData = {
      username: username, // base64EncodedUsername,
      password: password,
      localKeyGen: true
    }
    WL.JSONStore.closeAll({});
    WL.JSONStore.init(this.collections, authData).then((success) => {
      WL.JSONStore.get(this.collectionName).count({}, {}).then((countResult) => {
        if (countResult == 0) {
          WL.JSONStore.destroy(username);
          console.log('--> AuthHandler: offlineLogin failed. First time login must be done when internet connection is available');
          this.loginFailureCallback('First time login must be done when internet connection is available');
        } else {
          console.log('--> AuthHandler: offlineLogin success');
          this.loginSuccessCallback();
        }
      })
    }, (failure) => {
      console.log('--> AuthHandler: offlineLogin failed. Invalid username/password\n', JSON.stringify(failure));
      this.loginFailureCallback('Invalid username/password');
    })
  }
}
