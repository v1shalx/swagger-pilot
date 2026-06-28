package com.swaggerpilot.client;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.filter.log.LogDetail;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

/**
 * ApiClient — centralised REST-Assured configuration for the SwaggerPilot test suite.
 *
 * <p>All test classes that make HTTP calls should obtain their {@link RequestSpecification}
 * from {@link #getSpec()} rather than constructing one inline. This ensures that:
 * <ul>
 *   <li>The base URI is set from an environment variable so CI can override it.</li>
 *   <li>Every request logs its URL, headers, and body at DEBUG level to stdout.</li>
 *   <li>Every response logs its status and body on failure.</li>
 *   <li>The {@code Content-Type: application/json} header is always present.</li>
 * </ul>
 *
 * <h3>Usage</h3>
 * <pre>{@code
 * given(ApiClient.getSpec())
 *     .body(payload)
 *   .when()
 *     .post("/pets")
 *   .then()
 *     .statusCode(200);
 * }</pre>
 *
 * <h3>Configuration</h3>
 * Set {@code API_BASE_URL} in the environment (or CI job) to target a different server.
 * Defaults to the Petstore demo if unset.
 */
public final class ApiClient {

  /** Default target — Swagger Petstore v2 for demo runs. */
  private static final String DEFAULT_BASE_URL =
      System.getenv().getOrDefault("API_BASE_URL", "https://petstore.swagger.io/v2");

  /** Optional bearer token injected from the environment in authenticated suites. */
  private static final String AUTH_TOKEN =
      System.getenv().getOrDefault("API_AUTH_TOKEN", "");

  // Private constructor — utility class, not instantiable.
  private ApiClient() {}

  /**
   * Build and return a {@link RequestSpecification} with the base URI,
   * content-type, and request/response logging pre-configured.
   *
   * @return a shared but stateless spec suitable for use with {@code given()}.
   */
  public static RequestSpecification getSpec() {
    RequestSpecBuilder builder = new RequestSpecBuilder()
        .setBaseUri(DEFAULT_BASE_URL)
        .setContentType(ContentType.JSON)
        .setAccept(ContentType.JSON)
        .log(LogDetail.URI);         // Log every request URL to stdout

    // Add Authorization header only if a token is configured
    if (!AUTH_TOKEN.isBlank()) {
      builder.addHeader("Authorization", "Bearer " + AUTH_TOKEN);
    }

    // Globally enable response logging on failure so CI logs are self-contained
    RestAssured.enableLoggingOfRequestAndResponseIfValidationFails(LogDetail.BODY);

    return builder.build();
  }

  /**
   * Convenience accessor for the resolved base URL.
   * Useful when constructing absolute URLs in Selenium tests.
   *
   * @return the base URL string (e.g. {@code "https://petstore.swagger.io/v2"})
   */
  public static String getBaseUrl() {
    return DEFAULT_BASE_URL;
  }
}
