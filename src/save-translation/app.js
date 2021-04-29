/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const { marshall } = require("@aws-sdk/util-dynamodb");
const dynamoClient = new DynamoDB;
const TableName = process.env.TRANSLATE_TABLE

exports.handler = async function (event) {
  const Item = marshall(event.detail)

  console.log(JSON.stringify(event))

  try {
    return dynamoClient.putItem({TableName, Item});
  } catch (error){
    throw new Error(error.message)
  }
}