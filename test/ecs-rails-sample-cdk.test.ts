import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as EcsRailsSampleCdk from '../lib/ci';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new EcsRailsSampleCdk.CI(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
