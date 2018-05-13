## Steps
1. [Use Ionic-MFP-App as a starting point for this project](#step-1-use-ionic-mfp-app-as-a-starting-point-for-this-project)
2. [Support offline login](#step-2-support-offline-login)
  - 2.1 [Use JSONStore for offline login](#21-use-jsonstore-for-offline-login)
  - 2.2 [Update login page to call JSONStore based login when device is offline](#22-update-login-page-to-call-jsonstore-based-login-when-device-is-offline)
3. [Make Home page and Detail page work in offline mode (downstream sync)](#step-3-make-home-page-and-detail-page-work-in-offline-mode-downstream-sync)
  - 3.1 [Deploy MFP adapter that synchronizes data between Cloudant and JSONStore](#31-deploy-mfp-adapter-that-synchronizes-data-between-cloudant-and-jsonstore)
  - 3.2 [Use JSONStore for offline storage and syncing of data from Cloudant](#32-use-jsonstore-for-offline-storage-and-syncing-of-data-from-cloudant)
  - 3.3 [Update Home page to load data from JSONStore](#33-update-home-page-to-load-data-from-jsonstore)
  - 3.4 [Update views to take care of data wrapping by JSONStore](#34-update-views-to-take-care-of-data-wrapping-by-jsonstore)
  - 3.5 [Delete redundant code](#35-delete-redundant-code)
4. [Support reporting of new problems in offline mode (upstream sync)](#step-4-support-reporting-of-new-problems-in-offline-mode-upstream-sync)
  - 4.1 [Add code for upstream sync of data to Cloudant](#41-add-code-for-upstream-sync-of-data-to-cloudant)
  - 4.2 [Add code for upstream sync of images to Cloud Object Storage](#42-add-code-for-upstream-sync-of-images-to-cloud-object-storage)
  - 4.3 [Update Report New Problem page to work in offline mode as well](#43-update-report-new-problem-page-to-work-in-offline-mode-as-well)
  - 4.4 [Update Home page to show grievances reported in offline mode as well](#44-update-home-page-to-show-grievances-reported-in-offline-mode-as-well)
  - 4.5 [Delete redundant code](#45-delete-redundant-code)


## Step 1. Use Ionic-MFP-App as a starting point for this project

This project builds on top of the app built in https://github.com/IBM/Ionic-MFP-App. In this code pattern, we will update the app such that it is usable even when the device is offline.

Copy Ionic Mobile app and Mobile Foundation adapters from parent repo as per instructions in http://bit-traveler.blogspot.in/2012/08/git-copy-file-or-directory-from-one.html as shown below.

* Create your repo on [Github.com](https://github.com) and add `README.md` file. Clone your new repo.

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
$ ionic generate provider JsonStoreHandler
[OK] Generated a provider named JsonStoreHandler!
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
            return resolve(this.initCollections(username, password, isOnline));
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

https://ionicframework.com/docs/native/network/

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
      content: 'Signing in. Please wait ...',
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

## Step 3. Make Home page and Detail page work in offline mode (downstream sync)

### 3.1 Deploy MFP adapter that synchronizes data between Cloudant and JSONStore


### 3.2 Use JSONStore for offline storage and syncing of data from Cloudant

Update `IonicMobileApp/src/providers/json-store-handler/json-store-handler.ts` as below:

<pre><code>
...
<b>import { MyWardDataProvider } from '../my-ward-data/my-ward-data';</b>
...
export class JsonStoreHandlerProvider {
  isCollectionInitialized = {};
  <b>onSyncSuccessCallback = null;
  onSyncFailureCallback = null;
  objectStorageAccess = null;</b>

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
    syncAdapterPath: 'JSONStoreCloudantSync',
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
    if (collectionInstance != null) {
      collectionInstance.sync({}).then(() => {
        console.log('--> JsonStoreHandler downstream sync initiated');
      }, (failure) => {
        console.log('--> JsonStoreHandler Failed to initiate downstream sync\n' + failure);
      });
    } else {
      console.log('--> JsonStoreHandler Failed to initiate downstream sync\n' + 'Collection ' + this.myWardCollectionName + ' not yet initialized');
    }
  }
  
  loadObjectStorageAccess() {
    this.myWardDataProvider.getObjectStorageAccess().then(objectStorageAccess => {
      this.hasObjectStorageAccessChanged(objectStorageAccess).then((hasChanged) => {
        if (hasChanged) {
          this.objectStorageAccess = objectStorageAccess;
          let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
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
      if (this.objectStorageAccess) {
        // already loaded data
        return resolve(this.objectStorageAccess);
      }
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.objectStorageDetailsCollectionName);
      if (collectionInstance != null) {
        collectionInstance.findAll({}).then((results) => {
          if (results.length > 0) {
            this.objectStorageAccess = results[0].json;
            resolve(results[0].json);
          } else {
            resolve(null);
          }
        }, (failure) => {
          console.log('--> JsonStoreHandler: getObjectStorageAccess failed\n', failure);
          reject(failure);
        });
      } else {
        resolve(null);
      }
    });
  }</b>
}

</code></pre>


Update `IonicMobileApp/src/providers/my-ward-data/my-ward-data.ts` as below:

<pre><code>
...
export class MyWardDataProvider {
  ...
  <b>getObjectStorageAccess() {
    // console.log('--> MyWardDataProvider getting Object Storage AuthToken from adapter ...');
    return new Promise((resolve, reject) => {
      let dataRequest = new WLResourceRequest("/adapters/MyWardData/objectStorage", WLResourceRequest.GET);
      dataRequest.send().then((response) => {
        // console.log('--> MyWardDataProvider got Object Storage AuthToken from adapter ', response);
        resolve(response.responseJSON);
      }, (failure) => {
        console.log('--> MyWardDataProvider failed to get Object Storage AuthToken from adapter\n', JSON.stringify(failure));
        reject(failure);
      })
    });
  }</b>
  ...
}
</code></pre>


### 3.3 Update Home page to load data from JSONStore

Update `IonicMobileApp/src/pages/home/home.ts` as below:

<pre><code>
...
<b>import { JsonStoreHandlerProvider } from '../../providers/json-store-handler/json-store-handler';</b>
...
export class HomePage {
  ...
  <b>reloadData: boolean = false;</b>

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
      let view = this.navCtrl.getActive();
      if (view.instance instanceof HomePage) {
        console.log('--> HomePage onSyncSuccessCallback() called');
        this.loadData();
      } else {
        this.reloadData = true;
      }
    });
    if (this.reloadData) {
      this.reloadData = false;
      this.loadData();
    }</b>
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

### 3.4 Update views to take care of data wrapping by JSONStore

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

### 3.5 Delete redundant code

From `IonicMobileApp/src/providers/my-ward-data/my-ward-data.ts` delete the function `load()` which is now redundant.

## Step 4. Support reporting of new problems in offline mode (upstream sync)

### 4.1 Add code for upstream sync of data to Cloudant

Update `IonicMobileApp/src/providers/json-store-handler/json-store-handler.ts` as below:

<pre><code>
...
<b>import { Network } from '@ionic-native/network';</b>
...
export class JsonStoreHandlerProvider {
  ...
  constructor(<b>private network: Network, </b>public myWardDataProvider: MyWardDataProvider) {
    console.log('--> JsonStoreHandler constructor() called');
    <b>this.network.onConnect().subscribe(() => {
      console.log('--> JsonStoreHandlerProvider: Network connected!');
      // We just got a connection but we need to wait briefly
      // before we determine the connection type. Might need to wait.
      // prior to doing any api requests as well.
      setTimeout(() => {
        if (this.network.type != 'none') {
          this.initUpstreamSync();
        }
      }, 3000);
    });</b>
  }
  ...

  <b>newProblemsCollectionName = 'newproblems';
  newProblemsCollections = {
    newproblems: {
      searchFields: { problemDescription: 'string' }
    }
  };
  newProblemsCollectionOptions = {
    syncPolicy: 1,
    syncAdapterPath:'JSONStoreCloudantSync',
    onSyncSuccess: this.onUpstreamSyncSuccess.bind(this),
    onSyncFailure: this.onUpstreamSyncFailure.bind(this),
    username: null,
    password: null,
    localKeyGen: true
  };</b>
  ...

  initCollections(username, password, isOnline:boolean) {
    return new Promise( (resolve, reject) => {
      ...
      WL.JSONStore.init(this.userCredentialsCollections, options).then((success) => {
        console.log('--> JsonStoreHandler: successfully initialized \'' + this.userCredentialsCollectionName + '\' JSONStore collection.');
        ...
        WL.JSONStore.init(this.myWardCollections, this.myWardCollectionOptions).then((success) => {
          console.log('--> JsonStoreHandler: successfully initialized \'' + this.myWardCollectionName + '\' JSONStore collection.');
          WL.JSONStore.init(this.objectStorageDetailsCollections, options).then((success) => {
            console.log('--> JsonStoreHandler: successfully initialized \'' + this.objectStorageDetailsCollectionName + '\' JSONStore collection.');
            if (isOnline) {
              this.loadObjectStorageAccess.bind(this)();
            }
            <b>this.newProblemsCollectionOptions.username = encodedUsername;
            this.newProblemsCollectionOptions.password = password;
            WL.JSONStore.init(this.newProblemsCollections, this.newProblemsCollectionOptions).then((success) => {
              console.log('--> JsonStoreHandler: successfully initialized \'' + this.newProblemsCollectionName + '\' JSONStore collection.');
              resolve();
            }, (failure) => {
              console.log('--> JsonStoreHandler: failed to initialize \'' + this.newProblemsCollectionName + '\' JSONStore collection.\n' + JSON.stringify(failure));
              reject({collectionName: this.newProblemsCollectionName, failure: failure});
            });</b>
          }, (failure) => {
            ...
          });
        }, (failure) => {
          ...
        });
      }, (failure) => {
        ...
      });
    });
  }
  ...

  <b>initUpstreamSync() {
    let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
    if (collectionInstance != null) {
      collectionInstance.sync({}).then(() => {
        console.log('--> JsonStoreHandler upstream sync initiated');
      }, (failure) => {
        console.log('--> JsonStoreHandler Failed to initiate upstream sync\n' + failure);
      });
    } else {
      console.log('--> JsonStoreHandler Failed to initiate upstream sync\n' + 'Collection ' + this.newProblemsCollectionName + ' not yet initialized');
    }
  }

  onUpstreamSyncSuccess(data) {
    console.log('--> JsonStoreHandler onUpstreamSyncSuccess: ' + data);
    this.syncMyWardData();
  }

  onUpstreamSyncFailure(error) {
    console.log('--> JsonStoreHandler: upstream sync failed\n', error);
  }

  addNewGrievance(grievance) {
    return new Promise( (resolve, reject) => {
      console.log('--> JsonStoreHandler: adding following new grievance to JSONStore ...\n' + JSON.stringify(grievance));
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
      collectionInstance.add(grievance, {}).then((noOfDocs) => {
        console.log('--> JsonStoreHandler added new grievance.');
        resolve();
      }, (failure) => {
        console.log('--> JsonStoreHandler addNewGrievance failed\n', failure);
        reject(failure);
      });
    });
  }

  getUnSyncedData() {
    return new Promise( (resolve, reject) => {
      let collectionInstance: WL.JSONStore.JSONStoreInstance = WL.JSONStore.get(this.newProblemsCollectionName);
      if (collectionInstance != null) {
        collectionInstance.getAllDirty('{}').then((data) => {
          if (data.length > 0) {
            console.log('--> JsonStoreHandler: Data that is not yet synced with Cloudant = \n', data);
          }
          resolve(data);
        });
      } else {
        resolve({});
      }
    });
  }</b>
}
</code></pre>

### 4.2 Add code for upstream sync of images to Cloud Object Storage

Install Ionic native plugin for `File` as below:

```
$ npm install --save @ionic-native/file
```

Update `IonicMobileApp/src/app/app.module.ts` as below:

<pre><code>
...
<b>import { File } from '@ionic-native/file';</b>
@NgModule({
  ...
  providers: [
    ...
    <b>File,</b>
    FileTransfer,
  ]
})
...
</code></pre>

Create an Ionic Provider for handling upstream sync of images to Cloud Object Storage as below:

```
$ ionic generate provider UpstreamImageSync
[OK] Generated a provider named UpstreamImageSync!
```

Update `IonicMobileApp/src/providers/upstream-image-sync/upstream-image-sync.ts` as below:

<pre><code>

import { Injectable } from '@angular/core';
<b>import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { Network } from '@ionic-native/network';

import { JsonStoreHandlerProvider } from '../json-store-handler/json-store-handler';</b>

@Injectable()
export class UpstreamImageSyncProvider {
  <b>offlineImagesDir : string = 'offlineImagesDir';
  offlineImagesDirEntry = null;

  constructor(private transfer: FileTransfer, private file: File, private network: Network,
      private jsonStoreHandler: JsonStoreHandlerProvider) {
    console.log('--> UpstreamImageSyncProvider constructor() called');
    this.createOfflineImagesDirIfNotExists();
    this.network.onConnect().subscribe(() => {
      console.log('--> UpstreamImageSyncProvider: Network connected!');
      // We just got a connection but we need to wait briefly
      // before we determine the connection type. Might need to wait.
      // prior to doing any api requests as well.
      setTimeout(() => {
        if (this.network.type != 'none') {
          this.uploadOfflineImages();
        }
      }, 3000);
    });
  }

  createOfflineImagesDirIfNotExists() {
    this.file.checkDir(this.file.dataDirectory, this.offlineImagesDir).then(_ => {
      console.log('--> UpstreamImageSyncProvider: Directory ' + this.offlineImagesDir + ' exists');
      this.file.resolveDirectoryUrl(this.file.dataDirectory).then((baseDirEntry) => {
        this.file.getDirectory(baseDirEntry, this.offlineImagesDir, {}).then((dirEntry) => {
          this.offlineImagesDirEntry = dirEntry;
          console.log('--> UpstreamImageSyncProvider: Successfully resolved directory ' + this.offlineImagesDir);
        }).catch((err) => {
          console.log('--> UpstreamImageSyncProvider: Error getting directory ' + this.offlineImagesDir + ':\n' + JSON.stringify(err));
        });
      }).catch((err) => {
        console.log('--> UpstreamImageSyncProvider: Error resolving directory URL ' + this.file.dataDirectory + ':\n' + JSON.stringify(err));
      });
    }).catch(err => {
      console.log('--> UpstreamImageSyncProvider: Creating directory ' + this.offlineImagesDir + ' ...');
      this.file.createDir(this.file.dataDirectory, this.offlineImagesDir, false).then((dirEntry) => {
        this.offlineImagesDirEntry = dirEntry;
        console.log('--> UpstreamImageSyncProvider: Successfully created directory ' + this.offlineImagesDir);
      }).catch(err => {
        console.log('--> UpstreamImageSyncProvider: Error creating directory ' + this.offlineImagesDir + ':\n' + JSON.stringify(err));
      });
    });
  }

  getOfflineDirPath() {
    if (this.offlineImagesDirEntry != null) {
      return this.offlineImagesDirEntry.nativeURL;
    } else {
      return null;
    }
  }

  saveImageInOfflineDir(fileName, filePath) {
    return new Promise( (resolve, reject) => {
      (window as any).resolveLocalFileSystemURL(filePath, (entry) => {
        console.log('--> UpstreamImageSyncProvider: Copying ' + entry.nativeURL + ' to ' + this.file.dataDirectory + this.offlineImagesDir + '/' + fileName + ' ...');
        entry.copyTo(this.offlineImagesDirEntry, fileName, (newEntry) => {
          console.log('--> UpstreamImageSyncProvider: Successfully copied file to path {{' + newEntry.filesystem.name + '}}/' + newEntry.fullPath);
          resolve("");
        }, (err) => {
          console.log('--> UpstreamImageSyncProvider: copyTo failed: ' + JSON.stringify(err));
          reject(err);
        });
      }, (err) => {
        console.log('--> UpstreamImageSyncProvider: Error during resolveLocalFileSystemURL: ' + JSON.stringify(err));
        reject(err);
      });
    });
  }

  hasNetworkConnection() {
    // https://ionicframework.com/docs/native/network/
    return this.network.type !== 'none';
  }

  uploadImage(fileName, filePath) {
    return new Promise( (resolve, reject) => {
      if (!this.hasNetworkConnection()) {
        console.log('--> UpstreamImageSyncProvider: Device offline. Saving image on local file system for later upload to Cloud Object Storage');
        resolve(this.saveImageInOfflineDir(fileName, filePath));
      } else {
        this.jsonStoreHandler.getObjectStorageAccess().then(objectStorageAccess => {
          if (objectStorageAccess != null) {
            resolve(this.uploadImageToServer(fileName, filePath, objectStorageAccess));
          } else {
            reject('ObjectStorageAccess not yet initialized');
          }
        });
      }
    });
  }

  uploadImageToServer(fileName, filePath, objectStorageAccess) {
    return new Promise( (resolve, reject) => {
      let serverUrl = objectStorageAccess.baseUrl + fileName;
      console.log('--> UpstreamImageSyncProvider: Uploading image (' + filePath + ') to server (' + serverUrl + ') ...');
      let options: FileUploadOptions = {
        fileKey: 'file',
        fileName: fileName,
        httpMethod: 'PUT',
        headers: {
          'Authorization': objectStorageAccess.authorizationHeader,
          'Content-Type': 'image/jpeg'
        }
      }
      let fileTransfer: FileTransferObject = this.transfer.create();
      fileTransfer.upload(filePath, serverUrl, options) .then((data) => {
        // success
        console.log('--> UpstreamImageSyncProvider: Image upload successful:\n', data);
        resolve(data);
      }, (err) => {
        // error
        console.log('--> UpstreamImageSyncProvider: Image upload failed:\n', JSON.stringify(err));
        reject(err);
      })
    });
  }

  uploadOfflineImages() {
    if (!this.hasNetworkConnection()) {
      return;
    }
    this.jsonStoreHandler.getObjectStorageAccess().then(objectStorageAccess => {
      if (objectStorageAccess != null) {
        console.log('--> UpstreamImageSyncProvider: Listing images to be uploaded in  ' + this.offlineImagesDir+ ' ...');
        this.file.listDir(this.file.dataDirectory, this.offlineImagesDir).then((entries) => {
          entries.forEach((entry) => {
            console.log('--> UpstreamImageSyncProvider: Uploading image ' + entry.name + ' ...');
            this.uploadImageToServer(entry.name, entry.nativeURL, objectStorageAccess).then(() => {
              console.log('--> UpstreamImageSyncProvider: Removing cached file ' + entry.nativeURL + ' ...');
              entry.remove(() => {
                console.log('--> UpstreamImageSyncProvider: Successfully removed cached file ' + entry.nativeURL);
              }, (err) => {
                console.log('--> UpstreamImageSyncProvider: Error removing cached file:\n' + JSON.stringify(err));
              });
            }).catch((err) => {
              console.log('--> UpstreamImageSyncProvider: Error uploading image to server:\n' + JSON.stringify(err));
            });
          });
        }).catch((err) => {
          console.log('--> UpstreamImageSyncProvider: Error listing files in uploadOfflineImages: ' + JSON.stringify(err));
        });
      }
    });
  }</b>
}

</code></pre>

### 4.3 Update *Report New Problem* page to work in offline mode as well

Update `IonicMobileApp/src/pages/report-new/report-new.ts` as below:

<pre><code>
...
<b>// <del>import { MyWardDataProvider } from '../../providers/my-ward-data/my-ward-data';</del>
import { JsonStoreHandlerProvider } from '../../providers/json-store-handler/json-store-handler';
import { UpstreamImageSyncProvider } from '../../providers/upstream-image-sync/upstream-image-sync';</b>
...
export class ReportNewPage {
  ...
  constructor(public navCtrl: NavController, public navParams: NavParams,
    private camera : Camera, private alertCtrl: AlertController, private imageResizer: ImageResizer,
    private loadingCtrl: LoadingController, private toastCtrl: ToastController, private authHandler:AuthHandlerProvider<b>,
    private jsonStoreHandler:JsonStoreHandlerProvider, private upstreamImageSync: UpstreamImageSyncProvider</b>) {
    console.log('--> ReportNewPage constructor() called');
  }
  ...
  
  submit() {
    ...
    this.loader.present().then(() => {
      <b>// <del>this.myWardDataProvider.uploadNewGrievance(grievance).then(</del>
      this.jsonStoreHandler.addNewGrievance(grievance).then(</b>
        (response) => {
          this.loader.dismiss();
          this.showToast('Data Uploaded Successfully');
          this.loader = this.loadingCtrl.create({
            content: 'Uploading image to server. Please wait ...',
            dismissOnPageChange: true
          });
          this.loader.present().then(() => {
            <b>// <del>this.myWardDataProvider.uploadImage(imageFilename, this.capturedImage).then(</del>
            this.upstreamImageSync.uploadImage(imageFilename, this.capturedImage).then(</b>
              (response) => {
                this.imageResizer.resize(this.getImageResizerOptions()).then(
                  (filePath: string) => {
                    <b>// <del>this.myWardDataProvider.uploadImage(thumbnailImageFilename, filePath).then(</del>
                    this.upstreamImageSync.uploadImage(imageFilename, this.capturedImage).then(</b>
                      (response) => {
                        this.loader.dismiss();
                        this.showToast('Image Uploaded Successfully');
                        this.showAlert('Upload Successful', 'Successfully uploaded problem report to server', false, () => {
                          <b>// <del>this.myWardDataProvider.data.push(grievance);</del></b>
                          this.navCtrl.pop();
                        })
                      }, (failure) => {
                        ...
                    });
                  }).catch(e => {
                    ...
                  });
              }, (failure) => {
                ...
              });
          });
        }, (failure) => {
          ...
        }
      );
    });
  }
}
</code></pre>

### 4.4 Update *Home* page to show grievances reported in offline mode as well

Update `IonicMobileApp/src/pages/home/home.html` as below:

<pre><code>
...
&lt;ion-content padding&gt;
  &lt;ion-list&gt;
    &lt;button ion-item (click)="itemClick(grievance)" *ngFor="let grievance of grievances"&gt;
      &lt;ion-thumbnail item-left&gt;
        &lt;img img-cache img-cache-src="{{objectStorageAccess.baseUrl}}{{grievance.json.picture.thumbnail}}"&gt;
      &lt;/ion-thumbnail&gt;
      &lt;h2 text-wrap&gt;{{grievance.json.problemDescription}}&lt;/h2&gt;
      &lt;p&gt;@ {{grievance.json.address}}&lt;/p&gt;
    &lt;/button&gt;
  &lt;/ion-list&gt;
  <b>&lt;ion-list&gt;
    &lt;button ion-item (click)="itemClickOfflineData(grievance)" *ngFor="let grievance of offlineGrievances"&gt;
      &lt;ion-thumbnail item-left&gt;
        &lt;img src="{{offlineDirPath}}/{{grievance.json.picture.thumbnail}}"&gt;
      &lt;/ion-thumbnail&gt;
      &lt;h2 text-wrap&gt;{{grievance.json.problemDescription}}&lt;/h2&gt;
      &lt;p&gt;@ {{grievance.json.address}}&lt;/p&gt;
    &lt;/button&gt;
  &lt;/ion-list&gt;</b>
&lt;/ion-content&gt;
</code></pre>

Update `IonicMobileApp/src/pages/home/home.ts` as below:

<pre><code>
...
<b>// <del>import { MyWardDataProvider } from '../../providers/my-ward-data/my-ward-data';</del>
import { UpstreamImageSyncProvider } from '../../providers/upstream-image-sync/upstream-image-sync';</b>
...
export class HomePage {
  ...
  <b>offlineGrievances: any;
  offlineDirPath: string;</b>

  constructor(public navCtrl: NavController, public loadingCtrl: LoadingController,
    <b>public imgCache: ImgCacheService, private authHandler:AuthHandlerProvider,
    private jsonStoreHandler:JsonStoreHandlerProvider, private upstreamImageSync: UpstreamImageSyncProvider</b>) {
    console.log('--> HomePage constructor() called');
  }
  ...
  ionViewWillEnter() {
    console.log('--> HomePage ionViewWillEnter() called');
    this.initAuthChallengeHandler();
    this.jsonStoreHandler.setOnSyncSuccessCallback(() => {
      let view = this.navCtrl.getActive();
      if (view.instance instanceof HomePage) {
        console.log('--> HomePage onSyncSuccessCallback() called');
        this.loadData();
      }
    });
    <b>this.loadOfflineDataFromJsonStore();</b>
  }

  loadData() {
    if (this.loader == null) {
      console.log('--> HomePage creating new loader');
      this.loader = this.loadingCtrl.create({
        content: 'Loading data. Please wait ...'
      });
      this.loader.present().then(() => {
        <b>this.loadOfflineDataFromJsonStore();</b>
        this.loadDataFromJsonStore();
      });
    } else {
      console.log('--> HomePage reusing previous loader');
      <b>this.loadOfflineDataFromJsonStore();</b>
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
            <b>this.upstreamImageSync.uploadOfflineImages();</b>
          });
        });
      } else {
        console.log('--> HomePage objectStorageAccess not yet loaded');
      }
    });
  }
  ...
  <b>loadOfflineDataFromJsonStore() {
    this.jsonStoreHandler.getUnSyncedData().then(data => {
      this.offlineGrievances = data;
      this.offlineDirPath = this.upstreamImageSync.getOfflineDirPath();
    });
  }

  itemClickOfflineData(grievance) {
    this.navCtrl.push(ProblemDetailPage, { grievance: grievance, baseUrl: this.offlineDirPath });
  }</b>
  ...
}
</code></pre>

### 4.5 Delete redundant code

Delete redundant functions from `IonicMobileApp/src/providers/my-ward-data/my-ward-data.ts` which now looks as below:

<pre><code>
/// &lt;reference path="../../../plugins/cordova-plugin-mfp/typings/worklight.d.ts" /&gt;

import { Injectable } from '@angular/core';

@Injectable()
export class MyWardDataProvider {

  constructor() {
    console.log('--> MyWardDataProvider constructor() called');
  }

  getObjectStorageAccess() {
    // console.log('--> MyWardDataProvider getting Object Storage AuthToken from adapter ...');
    return new Promise((resolve, reject) => {
      let dataRequest = new WLResourceRequest("/adapters/MyWardData/objectStorage", WLResourceRequest.GET);
      dataRequest.send().then((response) => {
        // console.log('--> MyWardDataProvider got Object Storage AuthToken from adapter ', response);
        resolve(response.responseJSON);
      }, (failure) => {
        console.log('--> MyWardDataProvider failed to get Object Storage AuthToken from adapter\n', JSON.stringify(failure));
        reject(failure);
      })
    });
  }
}
</code></pre>
