# - Work in progress -

# Secure Offline Synchronization using IBM Mobile Foundation
The increasing focus on Digital Transformation has led to more and more use cases where organizations want their enterprise apps to be usable even when the device is offline, and later synchronize the data with the enterprise when the device comes online again. In addition, organizations want to leverage the benefits of:
* hybrid mobile apps where a single code base, developed using standard web technologies, works across platforms - Android, iOS and Windows phones, thereby enabling organizations to more easily embrace the policy of bring your own device (BYOD).
* cloud hosted mobile backend servers for robust handling of security challenges posed by above scenarios, backend integration, app life cycle management and app analytics.

In this IBM code pattern, we will show you how to combine the following technologies to securely implement the mobile offline synchronization use case.
* IBM Mobile Foundation - the enterprise grade mobile backend server available as a service on IBM Cloud,
* Ionic framework - an open-source SDK for hybrid mobile app development built on top of Apache Cordova and Angular,
* JSONStore - the encrypted on device storage & automated data sync for better app performance & offline access,
* IBM Cloudant - a fully managed NoSQL JSON database service available on IBM Cloud, and
* IBM Cloud Object Storage - A highly scalable cloud storage service, designed for high durability, resiliency and security.

When you have completed this code pattern, you will understand:
* How to achieve offline user authentication in mobile apps using JSONStore.
* How to store data securely on the device using encrypted JSONStore.
* How to achieve downstream and upstream synchronization of data between CouchDB/Cloudant database and the device using JSONStore's automated data synchronization feature.
* How to achieve downstream and upstream synchronization of images between Cloud Object Storage and the device using [imgCache.js](https://github.com/chrisben/imgcache.js/) and [Cordova File API](https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-file/).

## Flow

### Online scenario
<img src="doc/source/images/Architecture_Scenario1.png" alt="Architecture diagram - online scenario" width="1024" border="10" />

1. When there is network connectivity, user installs and launches the mobile app, enters his/her credentials on the login screen and clicks `Login`.
2. Mobile app sends the user credentials to MFP server for validation.
3. MFP server invokes the security adapter logic to validate user credentials and returns an appropriate response to the mobile app. For the sake of this demo, we will use a simple security adapter that returns success when password equals username.
4. If user authentication succeeds, mobile app initializes JSONStore collection with the current username and password. 
5. Mobile app initiates data synchronization with Cloudant database by making a call to MFP sync adapter.
6. MFP sync adapter makes REST calls to Cloudant database and returns synchronization data to the mobile app. The data fetched from Cloudant database will have references to the images stored on Cloud Object Storage.
7. In parallel to step 5 above, mobile app makes a call to MFP adapter to get the Authorization token for interacting with Cloud Object Storage service.
8. MFP adapter makes a call to Cloud Object Storage service's token manager endpoint to get the Authorization token
and returns it to the mobile app.
9. Mobile app initializes image-caching plugin and asks it to use an HTTP header of `Authorization=<value returned from MFP adapter>` while fetching images.
10. Once JSONStore synchronization is complete and Cloud Object Storage Authorization token is fetched, mobile app displays the synchronized data from JSONStore as a list of items on the `Home` page. The image caching plugin running on the mobile app downloads and caches images from Cloud Object Storage.
11. User clicks on one of the list item to see more details. A detail page is shown consisting of image and geo-location marked inside Google Maps.
12. Back in the home page, user clicks on `+` button to report a new civic problem. A new page is shown where user can enter a description for the new civic problem as well as capture image and geo-location of the problem spot. User clicks on `Submit` button.
13. Mobile app stores the new data into JSONStore collection, which automatically initiates synchronization of the new data with Cloudant database by making a call to MFP sync adapter.
14. MFP sync adapter POSTs the new data to Cloudant database.
15. In parallel to step 14 above, mobile app creates a thumbnail image by resizing the captured image and uploads both the captured image and thumbnail to Cloud Object Storage.
16. Other users who click on refresh button on the home page (and those who log in afresh) are shown the updated list of problem reports.

### Offline scenario
<img src="doc/source/images/Architecture_Scenario2.png" alt="Architecture diagram - offline scenario" width="1024" border="10" />

1. User launches the mobile app when the device is offline, enters his/her credentials on the login screen and clicks `Login`.
2. Mobile app tries to initialize the JSONStore collection with the username and password entered by user. JSONStore init succeeds only if the correct password is entered. (Recollect that the JSONStore password was set when the device was last online and user authentication had succeeded after invocation of the MFP security adapter).
3. If user authentication succeeds (through successful JSONStore init), mobile app reads data from the (previously synchronised) JSONStore collection, and shows the list of civic problems on the `Home` page.
4. User can click on one of the problems to see more details. In case the problem detail was previously seen when the device was online, then the problem's image would have been cached by [imgcache.js](https://github.com/chrisben/imgcache.js/), and the [Cordova plugin for Google Maps](https://github.com/mapsplugin/cordova-plugin-googlemaps#what-is-the-difference-between-this-plugin-and-google-maps-javascript-api-v3) would make sure that the map view works even in offline mode.
5. Back in the home page, user clicks on `+` button to report a new civic problem. A new page is shown where user can enter a description for the new civic problem as well as capture image and geo-location of the problem spot. User clicks on `Submit` button.
6. Mobile app stores the new data in JSONStore collection, and the image and its thumbnail on local file storage. Back on the `Home` page, user can see the new problem listed.
7. At at later time, when the device comes online, the mobile app automatically initiates the synchronization of JSONStore collection with Cloudant database by making a call to MFP sync adapter.
8. MFP sync adapter POSTs new data to Cloudant database.
9. In parallel to step 7 above, mobile app fetches Authorization token for interacting with Cloud Object Storage service by making a call to MFP adapter, and then uploads the new images to Cloud Object Storage.
10. Other users who click on refresh button on the home page (and those who log in afresh) can see the newly reported civic problem and its details.

## Included Components
* [Cloudant NoSQL DB](https://console.ng.bluemix.net/catalog/services/cloudant-nosql-db): A fully managed data layer designed for modern web and mobile applications that leverages a flexible JSON schema.
* [Cloud Object Storage](https://console.bluemix.net/catalog/infrastructure/cloud-object-storage): A highly scalable cloud storage service, designed for high durability, resiliency and security.
* [Mobile Foundation](https://console.bluemix.net/catalog/services/mobile-foundation): A scalable mobile access gateway powered by the market-leading IBM Mobile Foundation Technology. The service offers a comprehensive set of mobile backend capabilities such as, App life cycle, Push, Analytics, Feature Toggle, Security and Authentication and offline synch. 

## Featured Technologies
* [Mobile](https://mobilefirstplatform.ibmcloud.com/): Systems of engagement are increasingly using mobile technology as the platform for delivery.

# Watch the Video

# Steps
* [1. Setup Ionic and MFP CLI](https://github.com/IBM/Ionic-MFP-App#step-1-setup-ionic-and-mfp-cli)
* [2. Create Cloudant database and populate it with sample data](https://github.com/IBM/Ionic-MFP-App#step-2-create-cloudant-database-and-populate-it-with-sample-data)
* [3. Create IBM Cloud Object Storage service and populate it with sample data](https://github.com/IBM/Ionic-MFP-App#step-3-create-ibm-cloud-object-storage-service-and-populate-it-with-sample-data)
* [4. Create Mobile Foundation service and configure MFP CLI](https://github.com/IBM/Ionic-MFP-App#step-4-create-mobile-foundation-service-and-configure-mfp-cli)
* [5. Download source repo and customize](#step-5-download-source-repo-and-customize)
  - [5.1 Clone repo](#51-clone-repo)
  - [5.2 Update App ID, Name and Description](#52-update-app-id-name-and-description)
  - [5.3 Specify Cloudant credentials in MFP adapter](#53-specify-cloudant-credentials-in-mfp-adapter)
  - [5.4 Specify Cloud Object Storage credentials in MFP Adapter](#54-specify-cloud-object-storage-credentials-in-mfp-adapter)
* [6. Deploy the MFP Adapters and Test them](#step-6-deploy-the-mfp-adapters-and-test-them)
  - [6.1 Build and Deploy the MFP adapters](#61-build-and-deploy-the-mfp-adapters)
  - [6.2 Launch MFP dashboard and verify adapter configurations](#62-launch-mfp-dashboard-and-verify-adapter-configurations)
  - [6.3 Test the JSONStoreCloudantSync adapter](#63-test-the-jsonstorecloudantsync-adapter)
* [7. Run application on Android phone](https://github.com/IBM/Ionic-MFP-App#step-7-run-application-on-android-phone)
* [8. Test the app functionality in offline mode](#step-8-test-the-app-functionality-in-offline-mode)
  - [8.1 Test app in online mode](#81-test-app-in-online-mode)
  - [8.2 Test app in offline mode](#82-test-app-in-offline-mode)

## Prerequisite steps
This project builds on top of https://github.com/IBM/Ionic-MFP-App. Run following steps from that [base project](https://github.com/IBM/Ionic-MFP-App) to provision the needed mobile backend services from IBM Cloud and populate them with sample data, as well as to setup Ionic and MFP CLI on your development machine.
 - [Step 1. Setup Ionic and MFP CLI](https://github.com/IBM/Ionic-MFP-App#step-1-setup-ionic-and-mfp-cli)
 - [Step 2. Create Cloudant database and populate it with sample data](https://github.com/IBM/Ionic-MFP-App#step-2-create-cloudant-database-and-populate-it-with-sample-data)
 - [Step 3. Create IBM Cloud Object Storage service and populate it with sample data](https://github.com/IBM/Ionic-MFP-App#step-3-create-ibm-cloud-object-storage-service-and-populate-it-with-sample-data)
 - [Step 4. Create Mobile Foundation service and configure MFP CLI](https://github.com/IBM/Ionic-MFP-App#step-4-create-mobile-foundation-service-and-configure-mfp-cli)

## Step 5. Download source repo and customize

### 5.1 Clone repo

```
$ git clone https://github.com/IBM/MFP-JSONStore-OfflineSync.git
$ cd MFP-JSONStore-OfflineSync
```

### 5.2 Update App ID, Name and Description

Update `IonicMobileApp/config.xml` as below. Change `id`, `name`, `description` and `author` details appropriately.

<pre><code>
&lt;?xml version='1.0' encoding='utf-8'?&gt;
&lt;widget <b>id="org.mycity.myward"</b> version="2.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0" xmlns:mfp="http://www.ibm.com/mobilefirst/cordova-plugin-mfp"&gt;
    <b>&lt;name&gt;MyWard&lt;/name&gt;
    &lt;description&gt;Get your civic issues resolved by posting through this app.&lt;/description&gt;
    &lt;author email="shivahr@gmail.com" href="https://developer.ibm.com/code/author/shivahr/"&gt;Shiva Kumar H R&lt;/author&gt;</b>
...
</code></pre>

### 5.3 Specify Cloudant credentials in MFP adapter

Open `MobileFoundationAdapters/JSONStoreCloudantSync/src/main/adapter-resources/adapter.xml` and update the following properties to point to the Cloudant database created in [Step 2](https://github.com/IBM/Ionic-MFP-App#step-2-create-cloudant-database-and-populate-it-with-sample-data).
 * Update `key` and `password` with the Cloudant API key as generated in [Step 2.2](https://github.com/IBM/Ionic-MFP-App#22-generate-cloudant-api-key).
 * For property `account`, specify the Cloudant Dashboard URL portion after (and excluding) *https://* and upto (and including) *-bluemix.cloudant.com* as shown in the snapshot of [Step 2.2](https://github.com/IBM/Ionic-MFP-App#22-generate-cloudant-api-key).
 * For property `DBName`, leave the default value of `myward` as-is.
 * For property `protocol`, leave the default value of `https` as-is.
 * For property `port`, leave the default value of `443` as-is.
 * For property `createDatabaseIfItDoesNotExist`, leave the default value of `false` as-is.

<pre><code>
&lt;mfp:adapter name="JSONStoreCloudantSync" ...&gt;
  <b>&lt;property name="account" displayName="Cloudant account" defaultValue=""/&gt;
  &lt;property name="key" displayName="Cloudant key" defaultValue=""/&gt;
  &lt;property name="password" displayName="Cloudant password" defaultValue=""/&gt;</b>
  &lt;property name="DBName" displayName="Cloudant DB name" defaultValue="myward"/&gt;
  &lt;property name="protocol" displayName="DB protocol" defaultValue="https" /&gt;
  &lt;property name="port" displayName="Db port" defaultValue="443" /&gt;
  &lt;property name="createDatabaseIfItDoesNotExist" displayName="Create database if it does not exist?" defaultValue="false" /&gt;
  ...
&lt;/mfp:adapter&gt;
</code></pre>

### 5.4 Specify Cloud Object Storage credentials in MFP Adapter

Open `MobileFoundationAdapters/MyWardData/src/main/adapter-resources/adapter.xml` and update the following properties to point to the Cloud Object Storage created in [Step 3](https://github.com/IBM/Ionic-MFP-App#step-3-create-ibm-cloud-object-storage-service-and-populate-it-with-sample-data).
  * Specify value for `bucketName` as created in [Step 3.1](https://github.com/IBM/Ionic-MFP-App#31-create-ibm-cloud-object-storage). 
  * Specify `serviceId` and `apiKey` created in [Step 3.2](https://github.com/IBM/Ionic-MFP-App#32-create-service-id-and-api-key-for-accessing-objects).
  * While creating the bucket in [Step 3.1](https://github.com/IBM/Ionic-MFP-App#31-create-ibm-cloud-object-storage), if you selected a different Location/Resiliency, then update the `endpointURL` as per the specification in https://console.bluemix.net/docs/services/cloud-object-storage/basics/endpoints.html#select-regions-and-endpoints.

<pre><code>
&lt;mfp:adapter name="MyWardData" ...&gt;
  ...
  <b>&lt;property name="endpointURL" displayName="Cloud Object Storage Endpoint Public URL" defaultValue="https://s3-api.us-geo.objectstorage.softlayer.net"/&gt;
  &lt;property name="bucketName" displayName="Cloud Object Storage Bucket Name" defaultValue=""/&gt;
  &lt;property name="serviceId" displayName="Cloud Object Storage Service ID" defaultValue=""  /&gt;
  &lt;property name="apiKey" displayName="Cloud Object Storage API Key" defaultValue=""/&gt;</b>
&lt;/mfp:adapter&gt;
</code></pre>

## Step 6. Deploy the MFP Adapters and Test them

### 6.1 Build and Deploy the MFP adapters

Build and deploy `UserLogin` Adapter as below.

```
$ cd MobileFoundationAdapters/

$ cd UserLogin
$ mfpdev adapter build
$ mfpdev adapter deploy
```

  Note: In [Step 4](https://github.com/IBM/Ionic-MFP-App#step-4-create-mobile-foundation-service-and-configure-mfp-cli), if you specified `No` to `Make this server the default?`, then you need to specify the name of your server profile (`Cloud-MFP` in our case) at the end of `mfpdev adapter deploy` command as shown below.
```
$ mfpdev adapter deploy Cloud-MFP
```

Build and deploy `MyWardData` adapter as below.

```
$ cd ../MyWardData/
$ mfpdev adapter build
$ mfpdev adapter deploy
```

Build and deploy `JSONStoreCloudantSync` adapter as below.

```
$ cd ../JSONStoreCloudantSync/
$ mfpdev adapter build
$ mfpdev adapter deploy
```

### 6.2 Launch MFP dashboard and verify adapter configurations

Launch MFP Dashboard as below:
  * In the [IBM Cloud dashboard](https://console.bluemix.net/dashboard/), under `Cloud Foundry Services`, click on the `Mobile Foundation` service you created in [Step 4](https://github.com/IBM/Ionic-MFP-App#step-4-create-mobile-foundation-service-and-configure-mfp-cli). The service overview page that gets shown, will have the MFP dashboard embedded within it. You can also open the MFP dashboard in a separate browser tab by appending `/mfpconsole` to the *url* mentioned in [Step 4](https://github.com/IBM/Ionic-MFP-App#step-4-create-mobile-foundation-service-and-configure-mfp-cli).
  * Inside the MFP dashboard, in the list on the left, you will see the `JSONStoreCloudantSync`, `UserLogin` and `MyWardData` adapters listed.

Verify MFP Adapter configuration as below:
  * Inside the MFP dashboard, click on the `JSONStoreCloudantSync` adapter. Under `Configurations` tab, you should see the various properties we specified in [Step 5.3](#53-specify-cloudant-credentials-in-mfp-adapter) for accessing Cloudant database as shown below. As an alternative to specifying those property values in `MobileFoundationAdapters/JSONStoreCloudantSync/src/main/adapter-resources/adapter.xml` as previously shown in [Step 5.3](#53-specify-cloudant-credentials-in-mfp-adapter), you can deploy the adapters with empty `defaultValue`, and once the adapter is deployed, change the values on this page.

  <img src="doc/source/images/AdapterConfiguration.png" alt="Option to specify the credentials for accessing Cloudant NoSQL DB in deployed MFP Adapter" width="800" border="10" />

  * Click on `Resources` tab. You should see the various REST APIs exposed by `JSONStoreCloudantSync` adapter as shown below. The `Security` column should show the protecting scope `UserLogin` against each REST method.
    
  <img src="doc/source/images/AdapterProtectingScope.png" alt="The REST APIs of JSONStoreCloudantSync adapter are protected by UserLogin security scope" width="800" border="10" />

### 6.3 Test the JSONStoreCloudantSync adapter

Create temporary credentials to test adapter REST API as below:
  * Inside the MFP dashboard, click on `Runtime Settings`. Click on `Confidential Clients`. Then click on `New`.
  * In the form that pops up, specify values for `ID` and `Secret` as shown in snapshot below. For `Allowed Scope` enter `**` and click on `Add`. Finally click on `Save`.

  <img src="doc/source/images/MFP_CreateCredentialsToTestAdapter.png" alt="MFP - Create Confidential Client to test Adapter REST APIs" width="1024" border="10" />

Test adapter REST API as below:
  * Inside the MFP dashboard, click on the `JSONStoreCloudantSync` adapter. Click on `Resources` and then click on `View Swagger Docs`. The Swagger UI for adapter REST APIs will get shown in a new window/tab.
  * Inside the Swagger UI, click on `Expand Operations`.
  * To test the `POST /getAllModifications` API, first click on `OFF` toggle button to enable authentication. Select `UserLogin` and click on `Authorize` as shown below. Enter the `ID` and `Secret` created above against `Username` and `Password`. Click `OK`. If authentication is successful, the toggle button will switch to `ON` position.

  <img src="doc/source/images/AuthorizeSwaggerUI.png" alt="Authorize Swagger UI for running MFP Adapter REST APIs" width="1024" border="10" />

  * Specify the following JSON object under POST body:
```
{
  "_id": "string",
  "_rev": "string",
  "json": "{\"SeqID\": 0,\"DBName\": \"myward\"}"
}
```

  * Finally click on `Try it out` button to run the `POST /getAllModifications` API. The API response should get shown in the `Response Body` as shown in snapshot below.

  <img src="doc/source/images/SwaggerToolsForTestingMobileFirstAdapter.png" alt="Swagger UI for testing MobileFirst Adapters" width="1024" border="10" />
  
Delete the temporary credentials after testing adapter REST API as below:
  * Inside the MFP dashboard, click on `Runtime Settings`. Click on `Confidential Clients`.
  * Delete the `Client ID` created previously.


## Step 7. Run application on Android phone

Follow the instructions in [Step 7](https://github.com/IBM/Ionic-MFP-App#step-7-run-application-on-android-phone) of base project to run the application on Android phone.

## Step 8. Test the app functionality in offline mode

### How the app works in offline mode
A note on how the offline mode is supported for each of the pages<sup>\*</sup> in MyWard app: (<sup>\*</sup>Ionic page is the equivalent of [iOS View](https://developer.apple.com/library/content/documentation/WindowsViews/Conceptual/ViewPG_iPhoneOS/CreatingViews/CreatingViews.html) or [Android Activity](https://developer.android.com/guide/components/activities/))

* `Login` page:
  - The first time the app is launched after installation, the user login will work only in online mode. This is to make sure that the user credentials are validated by making a call to MFP security adapter. Once the user authentication succeeds, subsequent login attempts by the same user are supported in offline mode with the help of encrypted [JSONStore](https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/7.1/advanced-topics/offline-authentication/).

* `Home` page: (downstream sync)
  - [JSONStore](https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/8.0/application-development/jsonstore/) for storing/syncing data with Cloudant.
  - [imgcache.js](https://github.com/chrisben/imgcache.js/) for caching the image thumbnails loaded from Cloud Object Storage.

* `Problem Detail` page: (downstream sync)

  Grievances for which the details are already seen in online mode:
  - JSONStore for storing/syncing data with Cloudant.
  - imgcache.js for caching the image loaded from Cloud Object Storage.
  - [Cordova plugin for Google Maps](https://github.com/mapsplugin/cordova-plugin-googlemaps#what-is-the-difference-between-this-plugin-and-google-maps-javascript-api-v3) to make sure that the map view works even in offline mode.

* `Report New Problem` page: (upstream sync)
  - Data to be uploaded to Cloudant is stored in JSONStore which later syncs it with Cloudant when device comes online.
  - Image and its thumbnail are stored on local storage, and are later uploaded to Cloud Object Storage when devices comes online.

Note: In the current implementation, images and its thumbnails are stored as-is on the local file storage at [cordova.file.dataDirectory](https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-file/#where-to-store-files) which is private to the application. If you have a more stringent compliance requirement of having to encrypt the images stored locally on the phone, then follow the recommendations on [this](https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/8.0/application-development/jsonstore/#security-utilities) page.

### 8.1 Test app in online mode
* Build and run the application on your phone as per instructions in [Step 7.6](https://github.com/IBM/Ionic-MFP-App/blob/master/README.md#76-buildrun-the-ionic-application-on-android-phone).
* Login with username say `Test` and password `Test`. (Note: We have used a simple MFP security adapter that returns success when password equals username.)
* Make sure that the `Home` page displays list of grievances along with image thumbnails.
* Click on a few of the grievances to see their details. On the `Problem Detail` page, make sure that the image and Google Maps location are displayed.
* Back on the `Home` page, click on the `+` icon to report a new grievance. Add description, take photo, grab geolocation and finally submit. Make sure that the new grievance is successfully submitted to server.
* On a different device, whoever launches the app (or clicks on refresh button) should see your newly reported grievance.

### 8.2 Test app in offline mode
* Have the device go offline by turning off `Mobile data` and `Wi-Fi`.
* Launch the `MyWard` app.
* Login using the same username and password as before. Make sure login succeeds even in offline mode.
* Make sure that the `Home` page displays list of grievances along with image thumbnails.
* Click on the grievances for which you had seen the details before. Make sure that the image and Google Maps location are displayed even in offline mode.
* Back on the `Home` page, click on the `+` icon to report a new grievance. Add description, take photo, grab gelocation and finally submit. Make sure that the new grievance report is successfully accepted even in offline mode.
* Back on the `Home` page, the newly reported problem should get listed at the end along with its thumbnail. Upon clicking it, the `Problem Detail` page should show image.
* Get the device online by turning on either `Mobile data` or `Wi-Fi`.
* In a while the newly reported grievance would get uploaded to server and page would get refreshed to show new list of grievances as seen on server. Make sure that the grievance that you just reported is listed as well.
* On a different device, whoever launches the app (or clicks on refresh button) should see your newly reported grievance.

# Troubleshooting

Please see instructions for [debugging Android hybrid app using Chrome Developer Tools](https://github.com/IBM/Ionic-MFP-App#debugging-android-hybrid-app-using-chrome-developer-tools) or [troubleshooting guide](https://github.com/IBM/Ionic-MFP-App/blob/master/TROUBLESHOOTING.md) for solutions to some commonly occuring problems.

# References

* [JSONStore - Encrypted on device storage & automated data sync for better app performance & offline access](http://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/8.0/application-development/jsonstore/)
* [Offline authentication using JSONStore](https://mobilefirstplatform.ibmcloud.com/tutorials/en/foundation/7.1/advanced-topics/offline-authentication/)
* [Automated synchronization of JSONStore collections with CouchDB databases](https://mobilefirstplatform.ibmcloud.com/blog/2018/02/23/jsonstoresync-couchdb-databases/)
* [cordova-plugin-file - a File API allowing read/write access to files residing on the device](https://cordova.apache.org/docs/en/latest/reference/cordova-plugin-file/)

# License
[Apache 2.0](LICENSE)
