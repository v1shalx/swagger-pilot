# SwaggerPilot — Java Test Suite

Java-side quality gate for SwaggerPilot. Runs alongside the Node.js engine to demonstrate multi-stack SDET capability.

## Stack

| Tool | Purpose |
|---|---|
| **TestNG 7.9** | Test framework — groups, parallel execution, XML suites |
| **REST-Assured 5.4** | Fluent HTTP assertions + JSON schema validation |
| **Selenium 4 + WebDriverManager** | Headless browser smoke tests |
| **Allure 2** | Rich HTML reports published by Jenkins |
| **Jackson** | JSON serialization in test payloads |

## Structure

```
java-tests/
├── pom.xml                                   Maven build
├── Jenkinsfile                               CI pipeline
└── src/
    ├── main/java/com/swaggerpilot/
    │   └── client/ApiClient.java             Shared HTTP config
    └── test/java/com/swaggerpilot/
        ├── base/
        │   ├── BaseApiTest.java              REST-Assured base class
        │   └── BaseSeleniumTest.java         Selenium driver lifecycle
        ├── api/
        │   └── PetstoreApiTest.java          REST-Assured tests (5 categories)
        ├── selenium/
        │   ├── pages/SwaggerUiPage.java      Page Object Model
        │   └── SwaggerUiSmokeTest.java       Browser smoke tests
        └── resources/
            └── testng-suite.xml              Suite + group config
```

## Run Locally

```bash
cd java-tests

# Full suite
mvn clean test

# Smoke tests only (fast CI gate)
mvn clean test -Dgroups=smoke

# API tests only (no browser needed)
mvn clean test -Dgroups=api

# Skip Selenium (no Chrome on this machine)
mvn clean test -DexcludedGroups=selenium

# Target a different API
API_BASE_URL=http://localhost:3003/api mvn clean test
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `API_BASE_URL` | `https://petstore.swagger.io/v2` | API server to test |
| `API_AUTH_TOKEN` | _(empty)_ | Bearer token for authenticated endpoints |
| `SWAGGER_UI_URL` | `https://petstore.swagger.io` | Swagger UI URL for Selenium tests |

## Test Categories

| Group | Description |
|---|---|
| `smoke` | Fast sanity — is the API alive? |
| `contract` | Response shape matches the OpenAPI spec |
| `auth` | Protected routes reject unauthenticated requests |
| `boundary` | Edge-case inputs (invalid IDs, bad enums) |
| `crud` | Create → Read → Delete lifecycle |
| `selenium` | Browser-based Swagger UI verification |
