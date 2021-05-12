import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2';
import { LambdaProxyIntegration } from '@aws-cdk/aws-apigatewayv2-integrations';
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb';
import { EventBus, Rule } from '@aws-cdk/aws-events';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import { Policy, PolicyStatement } from '@aws-cdk/aws-iam';
import { Code, Function, Runtime, Tracing } from '@aws-cdk/aws-lambda';
import * as cdk from '@aws-cdk/core';
import { CfnOutput } from '@aws-cdk/core';

export class CdkDayStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ###################################################
    // Translation DDB table
    // ###################################################
    const translateTable = new Table(this, "TranslateTable", {
      partitionKey: {name: 'id', type: AttributeType.STRING},
      sortKey: {name: 'language', type: AttributeType.STRING}
    })
    
    // ###################################################
    // Translation EventBridge bus
    // ###################################################
    const translateBus = new EventBus(this, "TranslateBus", {
      eventBusName: "TranslateBus"
    })

    // ###################################################
    // Put translation function
    // ###################################################
    const putTranslationFunction = new Function(this, "PutTranslationFunction", {
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.handler',
      code: Code.fromAsset('src/put-translation'),
      tracing: Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(10),
      environment: {
        'TRANSLATE_BUS': translateBus.eventBusName
      }
    })

    translateBus.grantPutEventsTo(putTranslationFunction)

    const translatePolicyStatement = new PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*']
    })

    putTranslationFunction.role?.attachInlinePolicy(
      new Policy(this, "PutTranslatePolicy", {
        statements: [translatePolicyStatement]
      })
    )

    // ###################################################
    // Get translations function
    // ###################################################
    const getTranslationFunction = new Function(this, "GetTranslationFunction", {
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.handler',
      code: Code.fromAsset('src/get-translation'),
      tracing: Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(10),
      environment: {
        'TRANSLATE_TABLE': translateTable.tableName
      }
    })

    translateTable.grantReadData(getTranslationFunction)

    // ###################################################
    // Save translations function
    // ###################################################
    const saveTranslationFunction = new Function(this, "SaveTranslationFunction", {
      runtime: Runtime.NODEJS_14_X,
      handler: 'app.handler',
      code: Code.fromAsset('src/save-translation'),
      tracing: Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(10),
      environment:{
        'TRANSLATE_TABLE': translateTable.tableName
      }
    })

    translateTable.grantWriteData(saveTranslationFunction)

    // ###################################################
    // EventBridge Rule
    // ###################################################
    new Rule(this, "SaveTranslationRule", {
      eventBus: translateBus,
      eventPattern: {detailType: ["translation"]},
      targets:[new LambdaFunction(saveTranslationFunction)]
    })

    // ###################################################
    // API Gateway and routes
    // ###################################################
    const translateAPI = new HttpApi(this, "TranslateAPI")

    translateAPI.addRoutes({
      path: '/',
      methods: [HttpMethod.POST],
      integration: new LambdaProxyIntegration({
        handler: putTranslationFunction
      })
    })

    const getProxy = new LambdaProxyIntegration({
      handler: getTranslationFunction
    })

    translateAPI.addRoutes({
      path: '/{id}',
      methods: [HttpMethod.GET],
      integration: getProxy
    })

    translateAPI.addRoutes({
      path: '/',
      methods: [HttpMethod.GET],
      integration: getProxy
    })

    // ###################################################
    // Outputs
    // ###################################################
    new CfnOutput(this, 'API url', {
      value: translateAPI.url!
    })
    new CfnOutput(this, 'Put Function Name', {
      value: putTranslationFunction.functionName
    })
    new CfnOutput(this, 'Save Function Name', {
      value: saveTranslationFunction.functionName
    })
    new CfnOutput(this, 'Get Function Name', {
      value: getTranslationFunction.functionName
    })
    new CfnOutput(this, "Translation Bus", {
      value: translateBus.eventBusName
    })
    new CfnOutput(this, "Translation Table", {
      value: translateTable.tableName
    })
  }
}
