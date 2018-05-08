/**
 * Copyright 2018 IBM Corp.
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

import { Injectable } from '@angular/core';
import { FileTransfer, FileUploadOptions, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { Network } from '@ionic-native/network';

import { JsonStoreHandlerProvider } from '../json-store-handler/json-store-handler';

@Injectable()
export class UpstreamImageSyncProvider {
  offlineImagesDir : string = 'offlineImagesDir';
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
  }
}
