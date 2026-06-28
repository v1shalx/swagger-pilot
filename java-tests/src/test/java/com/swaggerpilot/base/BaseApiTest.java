package com.swaggerpilot.base;

import com.swaggerpilot.client.ApiClient;
import io.restassured.specification.RequestSpecification;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;

import java.lang.reflect.Method;

/**
 * BaseApiTest — abstract parent for all REST-Assured test classes.
 *
 * <p>Provides:
 * <ul>
 *   <li>A pre-configured {@link RequestSpecification} via {@link ApiClient#getSpec()}.</li>
 *   <li>Per-method logging so the test name is printed to stdout before each test —
 *       makes CI logs scannable without opening Allure.</li>
 * </ul>
 *
 * <p>Subclasses should not call {@code RestAssured.given()} directly; instead they
 * import {@code given} statically from {@link io.restassured.RestAssured} and pass
 * {@code spec} as the first argument:
 * <pre>{@code
 *   given(spec)
 *       .when().get("/pets")
 *       .then().statusCode(200);
 * }</pre>
 */
public abstract class BaseApiTest {

  /**
   * Shared request spec — initialised once per test class.
   * Thread-safe: REST-Assured specs are immutable after construction.
   */
  protected RequestSpecification spec;

  /**
   * Initialise the request spec before any test method in this class runs.
   * Runs once per class instance, not once per test method.
   */
  @BeforeClass(alwaysRun = true)
  public void initSpec() {
    spec = ApiClient.getSpec();
  }

  /**
   * Print the test method name to stdout before each test.
   * This provides a lightweight execution log even when Allure is not configured.
   *
   * @param method the TestNG method about to run — injected by the framework
   */
  @BeforeMethod(alwaysRun = true)
  public void logTestStart(Method method) {
    System.out.printf("%n▶  %s.%s%n", getClass().getSimpleName(), method.getName());
  }
}
