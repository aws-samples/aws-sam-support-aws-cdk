/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const {DynamoDB} = require("@aws-sdk/client-dynamodb")
const {marshall,unmarshall} = require("@aws-sdk/util-dynamodb");
const dynamoClient = new DynamoDB;
const TableName = process.env.TRANSLATE_TABLE

exports.getOne = async function (id) {
  let dynamoParams = {
    TableName,
    ExpressionAttributeValues: marshall({
      ":i": id
    }),
    KeyConditionExpression: "id = :i",
  }
  return dynamoClient.query(dynamoParams)
}

exports.getAll = async function () {
  let dynamoParams = {
    TableName,
    ExpressionAttributeNames: {
      "#l": "language",
    },
    ExpressionAttributeValues: marshall({
      ":l": "en",
    }),
    FilterExpression: "#l = :l"
  }
  return dynamoClient.scan(dynamoParams)
}

exports.handler = async function (event) {
  let response
  try {
    if (event.pathParameters && event.pathParameters.id)
      response = await exports.getOne(event.pathParameters.id)
    else
      response = await exports.getAll()

    return {"Items": response.Items.map(item => {
      let data = unmarshall(item)
      // delete data.language
      return data
    })}
  } catch (error) {
    throw new Error(error.message)
  }
}