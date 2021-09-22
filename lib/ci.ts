import * as cdk from '@aws-cdk/core'
import * as ecr from '@aws-cdk/aws-ecr'
import * as actions from '@aws-cdk/aws-codepipeline-actions'
import * as codepipeline from '@aws-cdk/aws-codepipeline'
import * as codebuild from '@aws-cdk/aws-codebuild'
import * as sns from '@aws-cdk/aws-sns'
import * as chatbot from '@aws-cdk/aws-chatbot'
import * as notifications from '@aws-cdk/aws-codestarnotifications'
import { RemovalPolicy, RemoveTag } from '@aws-cdk/core'
import { LinuxBuildImage } from '@aws-cdk/aws-codebuild'

// CodeBuild - Docker image -> ECR
export class CI extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here
    const repository = new ecr.Repository(this, 'ECSRailsSampleECR', {
      repositoryName: 'ecs-rails-sample',
      removalPolicy: RemovalPolicy.DESTROY,
      imageTagMutability: ecr.TagMutability.IMMUTABLE,
      imageScanOnPush: true
    })
    const project = new codebuild.PipelineProject(this, 'ECSRailsSampleECRCodeBuildProject', {
      environment: {
        // Dockerコンテナの中でDockerビルドすることになるのでDockerデーモンが必要で、そのためにprivilegedが必要
        // https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities
        privileged: true,
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_3 // defaultがSTANDARD_1_0という太古の遺産であり、指定必須
      },
      cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM),
    })
    repository.grantPullPush(project)

    const appOutput = new codepipeline.Artifact()
    const gitHubToken = cdk.SecretValue.secretsManager('GitHubToken')
    // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-codestarnotifications-readme.html#examples
    const topic = new sns.Topic(this, 'SlackNotification');
    const slack = new chatbot.SlackChannelConfiguration(this, 'SlackChannel', {
      slackChannelConfigurationName: cdk.SecretValue.secretsManager('SlackSettings', {jsonField: "channel_configuration_name"}).toString(),
      slackWorkspaceId: cdk.SecretValue.secretsManager('SlackSettings', {jsonField: "workspace_id"}).toString(),
      slackChannelId: cdk.SecretValue.secretsManager('SlackSettings', {jsonField: "channel_id"}).toString(),
    })
    const rule = new notifications.NotificationRule(this, 'NotificationRule', {
      source: project,
      events: [
        'codebuild-project-build-state-succeeded',
        'codebuild-project-build-state-failed',
      ],
      targets: [topic],
    })
    rule.addTarget(slack)

    const sourceAction = new actions.GitHubSourceAction({
      actionName: 'GitHubSourceAction',
      owner: 'SpringMT',
      oauthToken: gitHubToken,
      repo: 'ecs-rails-sample',
      branch: 'main',
      output: appOutput,
      runOrder: 1,
    })
    // https://dev.classmethod.jp/articles/cdk-approval-pipeline
    // https://www.npmjs.com/package/@cloudcomponents/cdk-codepipeline-slack これも試してみたい
    //const approvalAction = new actions.ManualApprovalAction({
    //  actionName: 'DeployApprovalAction',
    //  runOrder: 2,
    //  externalEntityLink: sourceAction.variables.commitUrl,
    //})

    // outputは指定しない
    // といってもECRにpushするか関係ないか
    const buildAction = new actions.CodeBuildAction({
      actionName: 'Docker-image-BuildAndPush',
      project,
      input: appOutput,
      environmentVariables: {
        REPOSITORY_URI: {value: repository.repositoryUri}
      },
      runOrder: 2,
    })

    const pipeline = new codepipeline.Pipeline(this, 'ECSRailsSampleECRCodePipeline', {
      pipelineName: 'ECSRailsSampleECRCodePipelineCI',
    })
    pipeline.addStage({
      stageName: 'GitHubSourceAction-stage',
      actions: [sourceAction],
    });
    pipeline.addStage({
      stageName: 'Docker-image-BuildAndPush',
      actions: [buildAction],
    })
  }
}
