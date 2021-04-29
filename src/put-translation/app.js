/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: MIT-0
 */

const {TranslateClient, TranslateTextCommand} = require("@aws-sdk/client-translate")
const {EventBridgeClient, PutEventsCommand} = require("@aws-sdk/client-eventbridge")
const translateClient = new TranslateClient();
const eventBridgeClient = new EventBridgeClient();
const translateCommand = new TranslateTextCommand();
const eventBridgeCommand = new PutEventsCommand();

exports.buildTranslationRequest = function (language, text){
  let translateParams = {
    SourceLanguageCode: 'en',
    TargetLanguageCode: language,
    Text: text,
  }
  translateCommand.input = translateParams;
  return translateClient.send(translateCommand);
}

exports.buildEventBridgePackage = function(translations, id){
  let entries = translations.map(item => {
    item['id'] = id
    return {
      Detail: JSON.stringify(item),
      DetailType: 'translation',
      EventBusName: process.env.TRANSLATE_BUS,
      Source: 'website'
    }
  })
  return {
    Entries: entries
  }
}

exports.handler = async function (event) {
  let body = JSON.parse(event.body)
  let translateText = body.text
  let lang = body.languages;

  let translations = lang.map(item => {
    return exports.buildTranslationRequest(item, translateText)
  })

  try {
    // get translations
    let translateResponse = await Promise.all(translations)
    let data = translateResponse.map(item => {
      return {"language": item.TargetLanguageCode, "translation": item.TranslatedText}
    })
    data.push({"language": "en", "translation": translateText})

    // send events to eventbridge
    eventBridgeCommand.input = exports.buildEventBridgePackage(data, event.requestContext.requestId);

    let ebresults = await eventBridgeClient.send(eventBridgeCommand);
    console.log(ebresults);

    return { "id":event.requestContext.requestId, "Items": data}

  } catch (error){
    throw new Error(error.message)
  }
}