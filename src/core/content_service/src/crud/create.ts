import { ObjectId } from "mongodb";
import {mongoDB} from "../../../db_service";
import { AddonInterface, ContentInterface, ErrorInterface } from "../../../interfaces";
import { locals } from "../../../response_handler";
import { user } from "../../../user_service";

/**
 * This function is used to add content to the database, only used by plugins.
 * content is stored as follows:
 * {
 *    _id: ObjectId | string;
 *    addon_id: ObjectId | string;
 *    type: string;
 *    owner?: ObjectId | string;
 *    history: {content: any, owner: ObjectId | string, date: Date, reason: string}[];
 *    content: any;
 * }
 * 
 * owner is optional, if it is not set, it will be left undefined, else it has to be a valid users id, them being the owner of the content allows them to modify it.
 * content: this is where the plugins data is stored, the rest is just metadata;
 * 
 * @param addon - The details of the addon trying to create content
 * @param type - The type of content to create, has to be a type defined in the addon json
 * @param returnError - If true, the function will return an error object instead of a boolean
 * @param content - The content to create { content: any, owner?: ObjectId }, content can be anything, while the owner is either undefined or a valid user BSON ID, or else it will be ignored
 *
 * @returns - If returnError is true, the function will return an error object, else it will return a boolean if an error occured, else it will return the content object
*/
export default async function(addon:AddonInterface, type:string, content:{ content:any, owner?:ObjectId }, returnError?: boolean): Promise<boolean | ErrorInterface | ContentInterface> {
    return new Promise(async(resolve:any, reject:any) => {
        // Validate that the type is valid
        if(!addon.types.includes(type)) {
            if(returnError === true) return reject({
                code: 1,
                local_key: locals.KEYS.INVALID_TYPE,
                where: 'create.ts',
                message: `The type ${type} is not defined in the addon ${addon.name}`
            } as ErrorInterface);

            return reject(false);
        }

        // Start creating the content
        let pushOBJ:ContentInterface = {
            _id: new ObjectId(),
            addon_id: new ObjectId(addon.id),
            type: type.toLowerCase(),
            history: [],
            content: content.content,
        };

        // If the owner is set, set it
        if(content?.owner !== undefined) {
            // Validate that the owner is valid
            if(ObjectId.isValid(content.owner) !== true) {
                if(returnError === true) return reject({
                    code: 1,
                    local_key: locals.KEYS.INVALID_ID,
                    where: 'create.ts',
                    message: `The owner ${content.owner} is not a valid BSON ID`
                } as ErrorInterface);

                else return reject(false);
            }

            else pushOBJ.owner = new ObjectId(content.owner);
        }
        
        // Check if an owner was set, if so we need to update the user
        if(pushOBJ.owner !== undefined) {
            // Get the user
            let user_data:any = await user.get(pushOBJ.owner, { content: 1 });

            // Check if the user exists
            if(user_data === false || user_data.message !== undefined || user_data[0] === undefined){
                if(returnError === true) return reject({
                    code: 1,
                    local_key: locals.KEYS.INVALID_ID,
                    where: 'create.ts',
                    message: `The owner ${content.owner} is not found`
                }) as ErrorInterface;

                else return reject(false);
            } 

            // Add the content to the user
            await user.update(pushOBJ.owner, { content: [...user_data.content || [], pushOBJ._id] }, returnError).catch(err => {
                if(err.code === 0) throw Error(err.message);
                else return resolve(err);
            }) ;
        }

        mongoDB.getClient(global.__DEF_MONGO_DB__, global.__AUTH_COLLECTIONS__.content_collection).insertOne(pushOBJ as any, (err:any, result:any) => {
            if (err) {
                if(returnError === true) return reject({
                    local_key: locals.KEYS.DB_ERROR,
                    where: 'update.ts',
                    message: err.message
                });

                return reject(false);
            }

            // if the content was added, return the content
            return resolve(pushOBJ);
        });
    });
}