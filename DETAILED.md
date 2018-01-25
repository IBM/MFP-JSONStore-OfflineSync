
## Step 1. Use Ionic-MFP-App as a starting point for this project

This project builds on top of the app built in https://github.com/IBM/Ionic-MFP-App. In this code pattern, we will update the app such that it is usable even when the device is offline.

Copy Ionic Mobile app and Mobile Foundation adapters from parent repo as per instructions in http://bit-traveler.blogspot.in/2012/08/git-copy-file-or-directory-from-one.html as shown below.

* Create your repo on github.com and add README.md file. Clone your new repo.

```
$ git clone https://github.com/<your-username>/<your-new-repo-name>.git
```

* Make a git format-patch for the entire history of the subdirectories that we want as shown below.

```
$ mkdir gitpatches
$ git clone https://github.com/IBM/Ionic-MFP-App.git
$ cd Ionic-MFP-App
$ git format-patch -o ../gitpatches/ --root IonicMobileApp/ MobileFoundationAdapters/
```

* Import the patches into your new repository as shown below.

```
$ cd ../<your-new-repo-name>
$ git am ../gitpatches/*
$ git push
```

## Step 2. Support offline login 

### 2.1 Use JSONStore for offline login

Follow tutorial https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/7.1/advanced-topics/offline-authentication/

Add Cordova plugin for Mobile Foundation JSONStore as below:

```
$ ionic cordova plugin add cordova-plugin-mfp-jsonstore
```

Add a new provider for working with JSONStore as below:

```
$ ionic generate provider JSONStoreHandler
[OK] Generated a provider named JSONStoreHandler!
```

Update `IonicMobileApp/src/providers/json-store-handler/json-store-handler.ts` as below:

<pre><code>
<b>/// &lt;reference path="../../../plugins/cordova-plugin-mfp-jsonstore/typings/jsonstore.d.ts" /&gt;</b>

import { Injectable } from '@angular/core';

@Injectable()
export class JsonStoreHandlerProvider {
  <b>isCollectionInitialized = {};

  userCredentialsCollectionName = 'userCredentials';
  userCredentialsCollections = {
    userCredentials: {
      searchFields: { username: 'string' }
    }
  }</b>

  constructor() {
    <b>console.log('--> JsonStoreHandler constructor() called');</b>
  }

  <b>// https://www.ibm.com/support/knowledgecenter/en/SSHS8R_8.0.0/com.ibm.worklight.apiref.doc/html/refjavascript-client/html/WL.JSONStore.html
  initCollections(username, password, isOnline:boolean) {
    return new Promise( (resolve, reject) => {
      if (username in this.isCollectionInitialized) {
        // console.log('--> JsonStoreHandler: collections have already been initialized for username: ' + username);
        return resolve();
      }
      console.log('--> JsonStoreHandler: initCollections called');
      let encodedUsername = this.convertToJsonStoreCompatibleUsername(username);
      console.log('--> JsonStoreHandler: username after encoding: ' + encodedUsername);
      let options = {
        username: encodedUsername,
        password: password,
        localKeyGen: true
      }
      WL.JSONStore.closeAll({});
      WL.JSONStore.init(this.userCredentialsCollections, options).then((success) => {
        console.log('--> JsonStoreHandler: successfully initialized \'' + this.userCredentialsCollectionName + '\' JSONStore collection.');
        this.isCollectionInitialized[username] = true;
        if (isOnline) {
          this.initCollectionForOfflineLogin();
        }
        resolve();
      }, (failure) => {
        if (isOnline) {
          console.log('--> JsonStoreHandler: password change detected for user: ' + username + ' . Destroying old JSONStore so as to recreate it.\n', JSON.stringify(failure));
          WL.JSONStore.destroy(encodedUsername).then(() => {
            return this.initCollections(username, password, isOnline);
          });
        } else {
          console.log('--> JsonStoreHandler: failed to initialize \'' + this.userCredentialsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
          reject(failure);
        }
      });
    });
  }

  initCollectionForOfflineLogin() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.userCredentialsCollectionName);
    collectionInstance.count({}, {}).then((countResult) => {
      if (countResult == 0) {
        collectionInstance.add({ name: this.userCredentialsCollectionName }, {});
        console.log('--> JsonStoreHandler: \'' + this.userCredentialsCollectionName + '\' JSONStore collection has been initialized for offlineLogin');
      }
    })
  }

  previousLoginExists() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.userCredentialsCollectionName);
      collectionInstance.count({}, {}).then((countResult) => {
        if (countResult == 0) {
          reject();
        } else {
          resolve();
        }
      })
    });
  }

  destroyCollections(username) {
    WL.JSONStore.destroy(username);
  }

  // JSONStore username must be an alphanumeric string ([a-z, A-Z, 0-9]) and start with a letter
  convertToJsonStoreCompatibleUsername(str: String) {
    // https://stackoverflow.com/questions/21647928/javascript-unicode-string-to-hex
    let result = "U"; // start with a letter
    for (let i=0; i&lt;str.length; i++) {
      let hex = str.charCodeAt(i).toString(16);
      result += ("0"+hex).slice(-4); // if you want to support Unicode text, then use ("000"+hex)
    }
    return result
  }</b>
}
</code></pre>

Update `IonicMobileApp/src/providers/auth-handler/auth-handler.ts` as below:

<pre><code>
...
<b>import { JsonStoreHandlerProvider } from '../json-store-handler/json-store-handler';</b>
...
export class AuthHandlerProvider {
  ...
  constructor(<b>private jsonStoreHandler:JsonStoreHandlerProvider</b>) {
    console.log('--> AuthHandler constructor() called');
  }

  init() {
    ...
    this.userLoginChallengeHandler.handleChallenge = this.handleChallenge.bind(this);
    <b>// this.userLoginChallengeHandler.handleSuccess = this.handleSuccess.bind(this);</b>
    this.userLoginChallengeHandler.handleFailure = this.handleFailure.bind(this);
  }

  ...

  <b>// handleSuccess(data) {
  //   console.log('--> AuthHandler handleSuccess called');
  //   this.isChallenged = false;
  //   if (this.loginSuccessCallback != null) {
  //     this.loginSuccessCallback();
  //   } else {
  //     console.log('--> AuthHandler: loginSuccessCallback not set!');
  //   }
  // }</b>

  ...

  login(username, password) {
    console.log('--> AuthHandler login called. isChallenged = ' + this.isChallenged);
    this.username = username;
    <b>this.userLoginChallengeHandler.handleSuccess = () => {
      console.log('--> AuthHandler handleSuccess called');
      this.isChallenged = false;
      this.jsonStoreHandler.initCollections(username, password, true).then(() => {
        this.loginSuccessCallback();
      });
    };</b>
    if (this.isChallenged) {
      this.userLoginChallengeHandler.submitChallengeAnswer({'username':username, 'password':password});
    } else {
      WLAuthorizationManager.login(this.securityCheckName, {'username':username, 'password':password})
      .then(
        (success) => {
          console.log('--> AuthHandler login success');
        },
        (failure) => {
          console.log('--> AuthHandler login failure: ' + JSON.stringify(failure));
          this.loginFailureCallback(failure.errorMsg);
        }
      );
    }
  }

  ...

  <b>offlineLogin(username, password) {
    console.log('--> AuthHandler offlineLogin called');
    this.jsonStoreHandler.initCollections(username, password, false).then((success) => {
      this.jsonStoreHandler.previousLoginExists().then(() => {
        console.log('--> AuthHandler offlineLogin success');
        this.loginSuccessCallback();
      }, () => {
        this.jsonStoreHandler.destroyCollections(username);
        console.log('--> AuthHandler offlineLogin failed. First time login must be done when internet connection is available');
        this.loginFailureCallback('First time login must be done when internet connection is available');
      });
    }, (failure) => {
      console.log('--> AuthHandler offlineLogin failed. Invalid username/password\n', JSON.stringify(failure));
      this.loginFailureCallback('Invalid username/password');
    })
  }</b>
}
</code></pre>

### 2.2 Update login page to call JSONStore based login when device is offline

http://ionicframework.com/docs/native/network/

Install the Cordova and Ionic plugins for Network information:

```
$ ionic cordova plugin add cordova-plugin-network-information
$ npm install --save @ionic-native/network
```

Add the network plugin to your app's module. Update `IonicMobileApp/src/app/app.module.ts` as below:

<pre><code>
...
<b>import { Network } from '@ionic-native/network';</b>
@NgModule({
  ...
  providers: [
    ...
    ImageResizer<b>,
    Network</b>
  ]
})
...
</code></pre>

Copy `IonicMobileApp/src/pages/login/login.ts` as below:

<pre><code>
...
<b>import { Network } from '@ionic-native/network';</b>
...
export class LoginPage {
  ...
  constructor(public navCtrl: NavController, public navParams: NavParams, <b>private network: Network,</b>
    public alertCtrl: AlertController, public authHandler:AuthHandlerProvider, public loadingCtrl: LoadingController) {
    ...
  }

  processForm() {
    // Reference: https://github.com/driftyco/ionic-preview-app/blob/master/src/pages/inputs/basic/pages.ts
    let username = this.fixedUsername != null ? this.fixedUsername : this.form.value.username;
    let password = this.form.value.password;
    if (username === "" || password === "") {
      this.showAlert('Login Failure', 'Username and password are required');
      return;
    }
    this.loader = this.loadingCtrl.create({
      content: 'Signining in. Please wait ...',
      dismissOnPageChange: true
    });
    this.loader.present().then(() => {
      <b>if (this.hasNetworkConnection()) {
        console.log('--> Online sign-in with user: ' + username);
        this.authHandler.login(username, password);
      } else {
        console.log('--> Offline sign-in with user: ' + username);
        this.authHandler.offlineLogin(username, password);
      }</b>
    });
  }

  <b>hasNetworkConnection() {
    // https://ionicframework.com/docs/native/network/
    return this.network.type !== 'none';
  }</b>
  ...
}

</code></pre>

## Step 3. Make Home page and Detail page work in offline mode

### 3.1 Use JSONStore for offline storage and syncing of data from Cloudant

Update `IonicMobileApp/src/providers/json-store-handler/json-store-handler.ts` as below:

<pre><code>
...
<b>import { MyWardDataProvider } from '../my-ward-data/my-ward-data';</b>
...
export class JsonStoreHandlerProvider {
  isCollectionInitialized = {};
  <b>onSyncSuccessCallback = null;
  onSyncFailureCallback = null;</b>

  userCredentialsCollectionName = 'userCredentials';
  userCredentialsCollections = {
    userCredentials: {
      searchFields: { username: 'string' }
    }
  }

  <b>myWardCollectionName = 'myward';
  myWardCollections = {
    myward: {
      searchFields: { reportedBy: 'string' }
    }
  };
  myWardCollectionOptions = {
    syncPolicy: 0,
    syncAdapterPath: '/adapters/JSONStoreCloudantSync/',
    onSyncSuccess: this.onSyncSuccess.bind(this),
    onSyncFailure: this.onSyncFailure.bind(this),
    username: null,
    password: null,
    localKeyGen: true
  };

  objectStorageDetailsCollectionName = 'objectStorageDetails';
  objectStorageDetailsCollections = {
    objectStorageDetails: {
      searchFields: { baseUrl: 'string' },
    }
  };</b>

  constructor(<b>public myWardDataProvider: MyWardDataProvider</b>) {
    console.log('--> JsonStoreHandler constructor() called');
  }

  // https://www.ibm.com/support/knowledgecenter/en/SSHS8R_8.0.0/com.ibm.worklight.apiref.doc/html/refjavascript-client/html/WL.JSONStore.html
  initCollections(username, password, isOnline:boolean) {
    return new Promise( (resolve, reject) => {
      if (username in this.isCollectionInitialized) {
        // console.log('--> JsonStoreHandler: collections have already been initialized for username: ' + username);
        return resolve();
      }
      console.log('--> JsonStoreHandler: initCollections called');
      let encodedUsername = this.convertToJsonStoreCompatibleUsername(username);
      console.log('--> JsonStoreHandler: username after encoding: ' + encodedUsername);

      let options = {
        username: encodedUsername,
        password: password,
        localKeyGen: true
      }
      WL.JSONStore.closeAll({});
      WL.JSONStore.init(this.userCredentialsCollections, options).then((success) => {
        console.log('--> JsonStoreHandler: successfully initialized \'' + this.userCredentialsCollectionName + '\' JSONStore collection.');
        this.isCollectionInitialized[username] = true;
        if (isOnline) {
          this.initCollectionForOfflineLogin();
        }

        <b>this.myWardCollectionOptions.username = encodedUsername;
        this.myWardCollectionOptions.password = password;
        WL.JSONStore.init(this.myWardCollections, this.myWardCollectionOptions).then((success) => {
          console.log('--> JsonStoreHandler: successfully initialized \'' + this.myWardCollectionName + '\' JSONStore collection.');

          WL.JSONStore.init(this.objectStorageDetailsCollections, options).then((success) => {
            console.log('--> JsonStoreHandler: successfully initialized \'' + this.objectStorageDetailsCollectionName + '\' JSONStore collection.');
            if (isOnline) {
              this.loadObjectStorageAccess.bind(this)();
            }
            resolve();
          }, (failure) => {
            console.log('--> JsonStoreHandler: failed to initialize \'' + this.objectStorageDetailsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
            reject({collectionName: this.objectStorageDetailsCollectionName, failure: failure});
          });

        }, (failure) => {
          console.log('--> JsonStoreHandler: failed to initialize \'' + this.myWardCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
          reject({collectionName: this.myWardCollectionName, failure: failure});
        });</b>

      }, (failure) => {
        if (isOnline) {
          console.log('--> JsonStoreHandler: password change detected for user: ' + username + ' . Destroying old JSONStore so as to recreate it.\n', JSON.stringify(failure));
          WL.JSONStore.destroy(encodedUsername).then(() => {
            return this.initCollections(username, password, isOnline);
          });
        } else {
          console.log('--> JsonStoreHandler: failed to initialize \'' + this.userCredentialsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
          reject({collectionName: this.userCredentialsCollectionName, failure: failure});
        }
      });
    });
  }

  ...

  <b>getData() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.myWardCollectionName);
      collectionInstance.findAll('{}').then((data) => {
        console.log('--> JsonStoreHandler: data fetched from JSONStore = \n', data);
        resolve(data);
      });
    });
  }

  onSyncSuccess(data) {
    console.log('--> JsonStoreHandler onSyncSuccess: ' + data);
    // TODO onSyncSuccessCallback should be called only if data has changed
    if (this.onSyncSuccessCallback != null) {
      this.onSyncSuccessCallback();
    } else {
      console.log('--> JsonStoreHandler: onSyncSuccessCallback not set!');
    }
  }

  onSyncFailure(error) {
    console.log('--> JsonStoreHandler: sync failed\n', error);
    if (this.onSyncFailureCallback != null) {
      this.onSyncFailureCallback(error);
    } else {
      console.log('--> JsonStoreHandler: onSyncFailureCallback not set!');
    }
  }

  setOnSyncSuccessCallback(onSyncSuccess) {
    this.onSyncSuccessCallback = onSyncSuccess;
  }

  setOnSyncFailureCallback(onSyncFailure) {
    this.onSyncFailureCallback = onSyncFailure;
  }

  syncMyWardData() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.myWardCollectionName);
    collectionInstance.sync();
  }
  loadObjectStorageAccess() {
    this.myWardDataProvider.getObjectStorageAccess().then(objectStorageAccess => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      this.hasObjectStorageAccessChanged(objectStorageAccess).then((hasChanged) => {
        if (hasChanged) {
          collectionInstance.clear({}).then(() => {
            collectionInstance.add(objectStorageAccess, {}).then((noOfDocs) => {
              console.log('--> JsonStoreHandler objectStorageAccess successfully updated.');
              if (this.onSyncSuccessCallback != null) {
                this.onSyncSuccessCallback();
              } else {
                console.log('--> JsonStoreHandler loadObjectStorageAccess(): onSyncSuccessCallback not set!');
              }
            }, (failure) => {
              console.log('--> JsonStoreHandler loadObjectStorageAccess(): add to JSONStore failed\n', failure);
            });
          });
        } else {
          console.log('--> JsonStoreHandler: objectStorageAccess has not changed.');
        }
      });
    });
  }

  hasObjectStorageAccessChanged(newObjectStorageAccess) {
    return new Promise( (resolve, reject) => {
      this.getObjectStorageAccess().then((oldObjectStorageAccess: any) => {
        if (oldObjectStorageAccess != null && oldObjectStorageAccess.baseUrl == newObjectStorageAccess.baseUrl &&
          oldObjectStorageAccess.authorizationHeader == newObjectStorageAccess.authorizationHeader) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  getObjectStorageAccess() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      collectionInstance.findAll({}).then((results) => {
        if (results.length > 0) {
          resolve(results[0].json);
        } else {
          resolve(null);
        }
      }, (failure) => {
        console.log('--> JsonStoreHandler: getObjectStorageAccess failed\n', failure);
        reject(failure);
      });
    });
  }</b>
}

</code></pre>

### 3.2 Update Home page to load data from JSONStore

<pre><code>
...
<b>import { JsonStoreHandlerProvider } from '../../providers/json-store-handler/json-store-handler';</b>
...
export class HomePage {
  ...

  constructor(public navCtrl: NavController, public loadingCtrl: LoadingController,
    public myWardDataProvider: MyWardDataProvider, public imgCache: ImgCacheService,
    private authHandler:AuthHandlerProvider<b>, private jsonStoreHandler:JsonStoreHandlerProvider</b>) {
    console.log('--> HomePage constructor() called');
  }

  ionViewDidLoad() {
    console.log('--> HomePage ionViewDidLoad() called');
    <b>this.loader = null;</b>
    this.loadData();
  }

  ionViewWillEnter() {
    console.log('--> HomePage ionViewWillEnter() called');
    this.initAuthChallengeHandler();
    <b>this.jsonStoreHandler.setOnSyncSuccessCallback(() => {
      console.log('--> HomePage onSyncSuccessCallback() called');
      this.loadData();
    });</b>
  }

  <b>loadData() {
    if (this.loader == null) {
      console.log('--> HomePage creating new loader');
      this.loader = this.loadingCtrl.create({
        content: 'Loading data. Please wait ...'
      });
      this.loader.present().then(() => {
        this.loadDataFromJsonStore();
      });
    } else {
      console.log('--> HomePage reusing previous loader');
      this.loadDataFromJsonStore();
    }
  }

  loadDataFromJsonStore() {
    this.jsonStoreHandler.getObjectStorageAccess().then(objectStorageAccess => {
      if (objectStorageAccess != null) {
        this.objectStorageAccess = objectStorageAccess;
        this.imgCache.init({
          headers: {
            'Authorization': this.objectStorageAccess.authorizationHeader
          }
        }).then( () => {
          console.log('--> HomePage initialized imgCache');
          this.jsonStoreHandler.getData().then(data => {
            this.grievances = data;
            this.loader.dismiss();
            this.loader = null;
          });
        });
      } else {
        console.log('--> HomePage objectStorageAccess not yet loaded');
      }
    });
  }</b>

  ...

  refresh() {
    <b>this.jsonStoreHandler.syncMyWardData();</b>
  }

  ...
}
</code></pre>

### 3.3 Update views to take care of data wrapping by JSONStore

JSONStore wraps our data inside a `json` element as shown below.
```
[
  { _id: 1, json: {problemDescription: '...', address: '...', ...} },
  { _id: 2, json: {problemDescription: '...', address: '...', ...} },
  ...
]
```

Hence, we need to update the references to our data in views/pages as shown below.

Update `IonicMobileApp/src/pages/home/home.html` as below:

<pre><code>
...
&lt;ion-content padding&gt;
  &lt;ion-list&gt;
    &lt;button ion-item (click)="itemClick(grievance)" *ngFor="let grievance of grievances"&gt;
      &lt;ion-thumbnail item-left&gt;
        &lt;img img-cache img-cache-src="{{objectStorageAccess.baseUrl}}<b>{{grievance.json.picture.thumbnail}}</b>"&gt;
      &lt;/ion-thumbnail&gt;
      &lt;h2 text-wrap&gt;<b>{{grievance.json.problemDescription}}</b>&lt;/h2&gt;
      &lt;p&gt;@ <b>{{grievance.json.address}}</b>&lt;/p&gt;
    &lt;/button&gt;
  &lt;/ion-list&gt;
&lt;/ion-content&gt;
</code></pre>

Update `IonicMobileApp/src/pages/problem-detail/problem-detail.html` as below:

<pre><code>
...
&lt;ion-content padding&gt;
  &lt;h2 text-wrap&gt;<b>{{grievance.json.problemDescription}}</b>&lt;/h2&gt;
  &lt;p&gt;Reported on: <b>{{grievance.json.reportedDateTime}}</b>&lt;/p&gt;
  &lt;img img-cache img-cache-src="{{baseUrl}}<b>{{grievance.json.picture.large}}</b>"&gt;
  &lt;p text-wrap&gt;@ <b>{{grievance.json.address}}</b>&lt;/p&gt;
  &lt;div id="map"&gt;&lt;/div&gt;
&lt;/ion-content&gt;
</code></pre>

Update `IonicMobileApp/src/pages/problem-detail/problem-detail.ts` as below:

<pre><code>
  ...
  loadMap() {
    let loc = new LatLng(<b>this.grievance.json.geoLocation.coordinates[1], this.grievance.json.geoLocation.coordinates[0]</b>);
    ...
  }
</code></pre>
