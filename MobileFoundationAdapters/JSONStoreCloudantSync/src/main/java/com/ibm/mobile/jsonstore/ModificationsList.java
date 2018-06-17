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

/*********
 * 
 * This class is to create an object of all the modifications 
 * to a particular cloud db.
 * 
 * 
 * 
 * *********/
package com.ibm.mobile.jsonstore;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;
import com.google.gson.JsonObject;

public class ModificationsList {

	static Logger logger = Logger.getLogger(ModificationsList.class.getName());
	
	public List<String> deletedDocIDs;

	public List<String> modifiedDocs;
	
	public List<String> newDocs;
	
	public String lastSeqID;

	ModificationsList(String seqID, List<String> deletedDocs,List<JsonObject> modifiedDocs, List<JsonObject> newDocs)
	{
		this.lastSeqID = seqID;
		if(deletedDocs.size() > 0)	
			this.deletedDocIDs = deletedDocs;
		else{
			this.deletedDocIDs = new ArrayList<String>();
			this.deletedDocIDs.add(null);
		}
		
		//If there are modified docs, then add it to this object
		//Else add null
		if(modifiedDocs.size() > 0)
		{
			this.modifiedDocs = new ArrayList<String>();
			for(JsonObject jsonDoc : modifiedDocs)
				this.modifiedDocs.add(jsonDoc.toString());
		}
		else
		{
			this.modifiedDocs = new ArrayList<String>();
			this.modifiedDocs.add(null);
		}

		//If there are new docs, then add it to this object
		//Else add null
		if(newDocs.size() > 0)
		{
			this.newDocs = new ArrayList<String>();
			for(JsonObject jsonDoc : newDocs)
				this.newDocs.add(jsonDoc.toString());
		}
		else
		{
			this.newDocs = new ArrayList<String>();
			this.newDocs.add(null);
		}
	}

}
