//----[Imports]----//

import { join } from 'path'
import { app } from '..';
const { graphqlHTTP } = require('express-graphql');
import { makeExecutableSchema } from '@graphql-tools/schema'

//------------------------------------//

let schemas:any[] = [],
    root_resolver:any = {};

/**
 * this defines custom schema + resolvers for the graphql api
 * 
 * @param path usaly __dirname, but can be anything
 * @param file_name usually 'schema.gql'
 * @param root_resolver the root resolver for the schema
 */
export function expandGQL(path:string, file_name:string, resolver:any) {
    // Load the schema
    schemas.push(require('fs').readFileSync(join(path, file_name), 'utf8'));

    // Load the resolvers
    Object.assign(root_resolver, resolver)
}

/**
 * This function is used to setup the graphql api,
 * after its called, no more changes can be made to the api,
 * to expand the schema you have to restart the server.
 */
export function lockGraphSQL(){
    const schema = makeExecutableSchema({
        typeDefs: schemas,
    });

    app.use('/graphql', graphqlHTTP({
        schema: schema,
        rootValue: root_resolver,
        graphiql: true
    }));    
}
