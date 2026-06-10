// Pure: a turnkey GitHub Actions workflow that fetches the dependency-free engine and runs it.
export function buildWorkflowYaml() {
  return `name: tests
on: [push, pull_request]
jobs:
  testctl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      # Fetch the dependency-free testctl engine (single bundled file).
      - run: curl -fsSL https://raw.githubusercontent.com/codekit-labs/testctl/main/dist/testctl.cjs -o testctl.cjs
      # Node-based stacks (Electron/Next.js/Supabase) work out of the box.
      # For Flutter add: uses: subosito/flutter-action@v2
      # For Frappe, run tests on a bench/CI service, not here.
      - run: node testctl.cjs run --quiet --report-junit=testctl-junit.xml
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: testctl-report
          path: testctl-junit.xml
`;
}

// Pure: a turnkey GitLab CI pipeline that fetches the engine and exposes the JUnit report.
export function buildGitlabYaml() {
  return `stages:
  - test

testctl:
  stage: test
  image: node:20
  script:
    # Fetch the dependency-free testctl engine (single bundled file).
    - curl -fsSL https://raw.githubusercontent.com/codekit-labs/testctl/main/dist/testctl.cjs -o testctl.cjs
    # Node-based stacks (Electron/Next.js/Supabase) work out of the box.
    # For Flutter/Frappe, add the relevant setup before this step.
    - node testctl.cjs run --quiet --report-junit=testctl-junit.xml
  artifacts:
    when: always
    reports:
      junit: testctl-junit.xml
    paths:
      - testctl-junit.xml
`;
}
