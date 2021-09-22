#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { CI } from '../lib/ci'
import { Network } from '../lib/network'
import { Storage } from '../lib/storage'
import { API } from '../lib/api'

const app = new cdk.App();
new CI(app, 'EcsRailsSampleCdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

const network = new Network(app, 'EcsRailsSampleNetwork')
new Storage(app, 'EcsRailsSampleStorage', {vpc: network.vpc, dbSG: network.dbSG})
new API(app, 'EcsRailsSampleAPI', {vpc: network.vpc, apiToDBSG: network.apiToDBSG, apiALBListener: network.aLBListener})
