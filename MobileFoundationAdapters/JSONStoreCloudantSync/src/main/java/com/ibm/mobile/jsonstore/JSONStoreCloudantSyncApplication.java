/**
* Copyright 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

package com.ibm.mobile.jsonstore;

import org.lightcouch.CouchDbProperties;
import com.ibm.mfp.adapter.api.ConfigurationAPI;
import com.ibm.mfp.adapter.api.MFPJAXRSApplication;
import org.lightcouch.CouchDbClient;

import javax.ws.rs.core.Context;
import java.util.logging.Logger;
import java.util.HashMap;

public class JSONStoreCloudantSyncApplication extends MFPJAXRSApplication{

	static Logger logger = Logger.getLogger(JSONStoreCloudantSyncApplication.class.getName());

	@Context
	ConfigurationAPI configurationAPI;
	
	HashMap<String, CouchDbClient> dbClients = new HashMap<String, CouchDbClient>();

	CouchDbClient dbClient = null;

	protected void init() throws Exception {
		logger.info("Adapter initialized!");
	}

    /* Returns a handle to the CouchDB connection */
    CouchDbClient connectToDB(String dbName) throws Exception {
	if (dbClients.containsKey(dbName)) {
		return dbClients.get(dbName);
	}else{
		try {
			String dbUsername = configurationAPI.getPropertyValue("username");
			String dbPassword = configurationAPI.getPropertyValue("password");
			String dbHost = configurationAPI.getPropertyValue("host");
			String dbProtocol = configurationAPI.getPropertyValue("protocol");
			String dbCreateNewIfNotExist = configurationAPI.getPropertyValue("createnewdbifnotexist");
			String dbPort = configurationAPI.getPropertyValue("port");
			CouchDbProperties properties = new CouchDbProperties();
			
			if(dbName.isEmpty())
			{
				dbName = configurationAPI.getPropertyValue("dbname");
			}
			properties.setDbName(dbName);
					
			if (dbHost != null && !dbHost.isEmpty()){
				properties.setHost(dbHost);
			}else{
				throw new Exception("Cloudant host name is unknown"); 	
			}

			if (dbUsername!= null && !dbUsername.isEmpty()){
				properties.setUsername(dbUsername); 
			}else{
				throw new Exception("Cloudant username is unknown"); 
			}
			
			if (dbPassword!= null && !dbPassword.isEmpty()){
				properties.setPassword(dbPassword); 
			}else{
				throw new Exception("Cloudant password is unknown"); 
			}

			if (dbProtocol!= null && !dbProtocol.isEmpty()){
				properties.setProtocol(dbProtocol); 
			}else{
				properties.setProtocol("https"); 
			}

			if (dbPort != null && !dbPort.isEmpty()){
				properties.setPort(Integer.parseInt(dbPort)); 
			}else{
				properties.setPort(443); 
			}
			
			if (dbCreateNewIfNotExist != null && !dbCreateNewIfNotExist.isEmpty()){
				properties.setCreateDbIfNotExist(Boolean.parseBoolean(dbCreateNewIfNotExist));
			}else{
				properties.setCreateDbIfNotExist(true); 
			}
			
			dbClient = new CouchDbClient(properties);
			dbClients.put(dbName, dbClient);
    
		} catch (Exception e){
			throw new Exception("Unable to connect to Cloudant DB, check the configuration.");
		}
	}
        return dbClient;
    	}

	protected void destroy() throws Exception {
		for (String dbName : dbClients.keySet()) {
			dbClients.get(dbName).shutdown();
		}
			logger.info("Adapter destroyed!");
	}

	protected String getPackageToScan() {
		//The package of this class will be scanned (recursively) to find JAX-RS resources.
		//It is also possible to override "getPackagesToScan" method in order to return more than one package for scanning
		return getClass().getPackage().getName();
	}
}
