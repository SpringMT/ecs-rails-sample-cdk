# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## cdk.json
```
{
  "app": "npx ts-node --prefer-ts-exts bin/ecs-rails-sample-cdk.ts",
  "context": {
    "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
    "@aws-cdk/core:enableStackNameDuplicates": "true",
    "aws-cdk:enableDiffNoFail": "true",
    "@aws-cdk/core:stackRelativeExports": "true",
    "@aws-cdk/aws-ecr-assets:dockerIgnoreSupport": true,
    "@aws-cdk/aws-secretsmanager:parseOwnedSecretName": true,
    "@aws-cdk/aws-kms:defaultKeyPolicies": true,
    "@aws-cdk/aws-s3:grantWriteWithoutAcl": true,
    "@aws-cdk/aws-ecs-patterns:removeDefaultDesiredCount": true,
    "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
    "@aws-cdk/aws-efs:defaultEncryptionAtRest": true,
    "@aws-cdk/aws-lambda:recognizeVersionProps": true,
    "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021": true,
    "EcsRailsSampleSecretArn": "arn:aws:secretsmanager:xxxx:xxxx",
    "AppTag": "xxxx"
  }
}
```

## GitHubのpersonal access tokenの生成と Secretへの登録

https://docs.aws.amazon.com/ja_jp/codepipeline/latest/userguide/appendix-github-oauth.html

```
aws secretsmanager create-secret --name GitHubToken --secret-string XXXXXXYYYYYYYYYZZZZZZ
aws secretsmanager create-secret --name SlackSettings --secret-string file://slack.json
```

```json
{
  "channel_configuration_name": "xxx",
  "workspace_id": "xxx",
  "channel_id": "xxxx"
}
```

## Target Group確認

```
aws elbv2 describe-target-groups
aws elbv2 describe-target-health --target-group-arn xxx
```

## ログ確認

```
awslogs get /ecs/ecs-rails-sample-api ALL --watch 
```

## DB Migration

```
aws ecs list-clusters
aws ecs list-services --cluster EcsRailsSample
aws ecs list-tasks --cluster EcsRailsSample --service-name EcsRailsSampleDB

aws ecs execute-command \
    --cluster EcsRailsSample \
    --task XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --container DB \
    --interactive \
    --command "/bin/bash"

bundle exec ridgepole -c config/stage_settings/$APP_STAGE/database.yml -E production -f db/Schemafile -a --dry-run
bundle exec ridgepole -c config/stage_settings/$APP_STAGE/database.yml -E production -f db/Schemafile -a
```

## テスト
```
curl -X POST -H "Content-Type: application/json" -d '{"user_id": "1"}' xxxx.ap-northeast-1.elb.amazonaws.com/v1/sessions -vvv
curl -H "Content-Type: application/json" xxxx.ap-northeast-1.elb.amazonaws.com/v1/sessions/#{session_id} -vvv
```

## 参考にした資料
