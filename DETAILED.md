
## Step 1. Use Ionic-MFP-App as a starting point for this project

This project builds on top of the app built in https://github.com/IBM/Ionic-MFP-App. Here we will make the app offline-first.

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

### 2.1 Save authenticated credentials in JSONStore and use it for offline login

Follow tutorial https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/7.1/advanced-topics/offline-authentication/

```
$ ionic cordova plugin add cordova-plugin-mfp-jsonstore
```

Update `IonicMobileApp/src/providers/auth-handler/auth-handler.ts` as below:

<pre><code>
/// &lt;reference path="../../../plugins/cordova-plugin-mfp/typings/worklight.d.ts" /&gt;
<b>/// &lt;reference path="../../../plugins/cordova-plugin-mfp-jsonstore/typings/jsonstore.d.ts" /&gt;</b>
...
export class AuthHandlerProvider {
  ...

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
          <b>this.storeCredentialsInJSONStore(username, password);</b>
        },
        (failure) => {
          console.log('--> AuthHandler: login failure: ' + JSON.stringify(failure));
          self.loginFailureCallback(failure.errorMsg);
        }
      );
    }
  }

  ...

  <b>collectionName = 'userCredentials';
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
        console.log('--> Online sign-in with user: ', username);
        this.authHandler.login(username, password);
      } else {
        console.log('--> Offline sign-in with user: ', username);
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
