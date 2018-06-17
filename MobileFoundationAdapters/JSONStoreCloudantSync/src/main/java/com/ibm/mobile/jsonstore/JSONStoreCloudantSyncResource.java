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

import java.util.ArrayList;
import java.util.List;

import org.json.JSONObject ; 

import javax.ws.rs.Consumes;
import javax.ws.rs.DELETE;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.QueryParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import com.ibm.mfp.adapter.api.AdaptersAPI;

import org.lightcouch.ChangesResult;
import org.lightcouch.ChangesResult.Row;
import org.lightcouch.CouchDbClient;

import com.google.gson.JsonArray;
import com.google.gson.JsonParser;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject ;

import java.util.logging.Logger;



@Path("/")
public class JSONStoreCloudantSyncResource {

	static Logger logger = Logger.getLogger(JSONStoreCloudantSyncResource.class.getName());
	private static String CLOUDANT_ID = "_cloudant_id"; 
	private static String CLOUDANT_REV_ID = "_cloudant_rev"; 
	private static String ALL_DOCS = "_all_docs";
	private static String SEQ_ID = "SeqID";
	private static String DB_NAME = "DBName";
	private static String IDS = "Ids";

	/*
	 * For more info on JAX-RS see https://jax-rs-spec.java.net/nonav/2.0-rev-a/apidocs/index.html
	 */

	@Context
	AdaptersAPI adaptersAPI;

	/****
	*This helper function provides an instance to connect and query to the Cloudant DB.
	****/
    private CouchDbClient getDB(String DBName) throws Exception {
        JSONStoreCloudantSyncApplication app = adaptersAPI.getJaxRsApplication(JSONStoreCloudantSyncApplication.class);
        try{
        	return app.connectToDB(DBName);
        }
        catch(Exception e){
            throw new Exception("Unable to connect to Cloudant DB : "+DBName+".Please check the configuration. Error msg : "+ e.getMessage());
    	}
    }


	/***********
	*This method accepts as input an object of type JSONStoreDocument. 
	*The input paramters contains
	* 1. A list of all cloudant _id and _rev_id that are present in the jsonstore collection. This list is empty if it is an initiazation.
	* 2. A last sequence id. This is needed to get all the changes that happened from the previous sync. If initialization, seq id is 0.
	**
	**This function returns a list of deleted doc IDs, list of modified documents and list of new documents
	**
	***********/

	/**
	 * This endpoint is called during downstream sync. 
	 * @param documentMetadata - Contains a list of Cloudant ID and Cloudant Rev ID of all documents in the 
	 * JSONStore Collection.
	 * The input format is 
	 * {
	 * "ids" : [ { "_cloudant_id": cloudant_id , 
	 * 				"_cloudant_rev_id" : cloudant rev id
	 * 			  }, 
	 * 			  ....
	 * 			 ]
	 * }
	 * @param seqid - Last synced sequence id. This is 0 on the first time load.
	 *
	 * @param dbName - The name of the cloudant Database.
	 * 
	 * @return All modified documents since the last sync. New and updated documents are returned in full. 
	 * In case of documents deleted on Cloudant, the Cloudant ID is returned. Also the last sync id is returned.
	 */
    @POST
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces("application/json")
    @Path("/modifications")
	public Response getAllModifications(@QueryParam("db_name") String dbName,
		@QueryParam("seqid") String seqid, JSONStoreDocument documentMetadata) throws Exception {
    	
    	//Declare variables to hold the modifications if any
		List<JsonObject> newDocs=new ArrayList<JsonObject>();
		List<JsonObject> modifiedDocs=new ArrayList<JsonObject>();
		List<String> allDeletedIDs=new ArrayList<String>();
		String seqID = "";
				
		try{
			//If the input json is not empty, then process the request, else return error 418.
        	if(!documentMetadata.getJson().equals("")){
				JsonParser parser = new JsonParser();
				JsonArray rootObj = parser.parse(documentMetadata.getJson()).getAsJsonArray();
				CouchDbClient dbClient = getDB(dbName);
				logger.info("Getting all data from DB : " + dbName);
				
				if(seqid.equals("0"))
				{
					/* This is a first time sync from this device */
					/* Step 1: Get all new documents */ 
					newDocs = dbClient.view(ALL_DOCS).includeDocs(true).query(JsonObject.class);
					//Call the changes api for the last seq id
					ChangesResult changeResult = dbClient.changes()
								.since(seqid)
								.getChanges();
								
					seqID = changeResult.getLastSeq();
					logger.info("Initial load completed");
				}
				else
				{
					//This is not a first sync. Get the list of docs changed since the previous sync.
					List<String> idList = new ArrayList<String>();
		
					//Form lists of cloudant ids and rev ids
					for (JsonElement id : rootObj) {
						idList.add(id.getAsJsonObject().get(CLOUDANT_ID).getAsString());
					}
					
					//Call the changes api
					ChangesResult changeResult = dbClient.changes()
								.since(seqid)
								.getChanges();
								
					List<Row> docIDs = changeResult.getResults();						    
					for(Row row : docIDs )
					{
						//If the doc has been deleted, then append the deleted doc's id to the deletedIDs string
						if(row.isDeleted()){
							if(idList.contains(row.getId().toString()))
								allDeletedIDs.add(row.getId());
						}
						else if(row != null && !row.toString().startsWith("{\"last_seq\":")) {
							//If it is not deleted, then the doc is either new or modified.
							//If the doc's id is already present in the list of docs that was created from the client input parameter, then it means that the doc has been modified. Else it means that it is a new doc.
							if(idList.contains(row.getId())){
								modifiedDocs.add(getDB(dbName).find(JsonObject.class,row.getId()));
							}
							else
							{
								newDocs.add(getDB(dbName).find(JsonObject.class,row.getId()));
							}
						}
					} 
					seqID = changeResult.getLastSeq();
					logger.info("All new, deleted and modified documents since last sync obtained");
				}

				List<ModificationsList> output = new ArrayList<ModificationsList>();	
				output.add(new ModificationsList(seqID,allDeletedIDs,modifiedDocs,newDocs));
				
				return Response.ok(output).build();
				}	
			}catch(Exception e)
			{
				e.printStackTrace();
				String msg = "Exception in JSONStoreCloudantSyncResource.java : "+e.getMessage();
				logger.info(msg);
				return Response.status(418).entity(msg).build();
			}
		 return Response.status(418).build();
    }


	/**
	 * This method is called every time a document is updated in the JSONStore and the JSONStoreCollection is set to 
	 * SYNC_UPSTREAM. 
	 * @param - The name of the database to update
	 *
	 * @param - The JSONStore document to be updated.
	 * 
	 */
	@POST
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces("application/json")
	@Path("/update")
	public javax.ws.rs.core.Response updateEntry(@QueryParam("db_name") String dbName,
	JSONStoreDocument json) throws Exception {
		try{
			JsonParser parser = new JsonParser(); 
			JsonObject jsonToSave = parser.parse(json.getJson()).getAsJsonObject(); 
			logger.info("Updating document to Cloudant - JSON is  " + jsonToSave.toString());
			logger.info("Updating document to Cloudant - Cloudant ID is " + json.get_id());
			logger.info("Updating document to Cloudant - REV id is " + json.get_rev());
			
			/* Save the cloudant ID and rev id and remove them from the actual JSON */
			String cloudantId = json.get_id();
			String cloudantRevId = json.get_rev(); 

			jsonToSave.addProperty("_id", cloudantId);
			jsonToSave.addProperty("_rev", cloudantRevId);

			org.lightcouch.Response couchResponse = getDB(dbName).update(jsonToSave);
			JSONObject responseObject = new JSONObject(); 
				
			if (couchResponse.getError() == null ){
				responseObject.put(CLOUDANT_ID, couchResponse.getId());
				responseObject.put(CLOUDANT_REV_ID, couchResponse.getRev());
				return Response.ok(responseObject.toString()).build();
			}else{
				return Response.ok("Error occurred saving to Cloudant" + responseObject.toString()).build();
			}
		}catch(Exception ex){
			ex.printStackTrace();
			logger.info("Exception occurred " + ex.getMessage());
		}
		return Response.status(418).build();
	}

	/**
	 * This method is called every time a document is added in the JSONStore and the JSONStoreCollection is set to
	 * SYNC_UPSTREAM.
	 * @param - The name of the database to update.
	 *
	 * @param - The JSONStore document to be added.
	 *
	 */
	@POST
	@Consumes(MediaType.APPLICATION_JSON)
	@Produces("application/json")
	public javax.ws.rs.core.Response addEntry(@QueryParam("db_name") String dbName,
		JSONStoreDocument json) throws Exception {
		try{
			JsonParser parser = new JsonParser(); 
			JsonObject jsonToSave = parser.parse(json.getJson()).getAsJsonObject(); 
			logger.info("Adding new document to Cloudant DB " + dbName + " : " + jsonToSave.toString());
			
			org.lightcouch.Response couchResponse = getDB(dbName).save(jsonToSave);
			JSONObject responseObject = new JSONObject(); 
				
			if (couchResponse.getError() == null ){
				responseObject.put(CLOUDANT_ID, couchResponse.getId());
				responseObject.put(CLOUDANT_REV_ID, couchResponse.getRev());
				return Response.ok(responseObject.toString()).build();
			}else{
				return Response.ok("Error occurred " + responseObject.toString()).build();
			}
		}catch(Exception ex){
			ex.printStackTrace();
			logger.info("Error occurred " + ex.getMessage());
		}
		return Response.status(418).build();
	}

	/**
	 * This method is called every time a document is deleted in the JSONStore and the JSONStoreCollection is set to
	 * SYNC_UPSTREAM.
	 * @param - The name of the database to update
	 *
	 * @param - The JSONStore document to be deleted.
	 *
	 */
	@DELETE
	@Path("/{id}/{rev}")
	public Response deleteEntry(@PathParam("id") String id, 
	@PathParam("rev") String rev , @QueryParam("db_name") String dbName ) throws Exception {
		try{
			logger.info("Deleting document with ID & rev " + id + " , " + rev);
			getDB(dbName).remove(id, rev);
			return Response.ok().build();
		}
		catch(Exception e){
			e.printStackTrace();
			 return Response.status(418).entity(e.getMessage()).build();
		}
	}

}
