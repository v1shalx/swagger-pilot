package com.swaggerpilot.selenium;

import com.swaggerpilot.base.BaseSeleniumTest;
import com.swaggerpilot.selenium.pages.SwaggerUiPage;
import io.qameta.allure.Description;
import io.qameta.allure.Feature;
import io.qameta.allure.Severity;
import io.qameta.allure.SeverityLevel;
import io.qameta.allure.Story;
import org.testng.annotations.Test;

import static org.testng.Assert.*;

/**
 * SwaggerUiSmokeTest — Selenium smoke tests for the Swagger UI documentation page.
 *
 * <p>These tests verify that the OpenAPI documentation portal is:
 * <ul>
 *   <li>Reachable (HTTP 200, page renders in browser)</li>
 *   <li>Showing API endpoints (the spec loaded correctly)</li>
 *   <li>Containing the expected API structure</li>
 * </ul>
 *
 * <p>This class demonstrates the <b>Page Object Model</b> pattern: test methods
 * contain zero raw selectors — all DOM knowledge lives in {@link SwaggerUiPage}.
 * This makes tests readable, maintainable, and immune to CSS class renames.
 *
 * <h3>Why Selenium for a documentation page?</h3>
 * Swagger UI is a React SPA that renders completely client-side. A plain HTTP
 * request returns empty HTML. Only a real browser can verify that the JS bundle
 * loads, the spec is fetched, and the endpoint list renders — which is exactly
 * what an SDET needs to assert.
 */
@Feature("Swagger UI Documentation Portal")
public class SwaggerUiSmokeTest extends BaseSeleniumTest {

  /**
   * Verify the Swagger UI page loads and renders at least one API endpoint.
   * This is the minimal "is the docs portal alive?" check.
   */
  @Test(groups = {"smoke", "selenium"})
  @Severity(SeverityLevel.BLOCKER)
  @Story("Documentation portal is accessible")
  @Description(
      "Navigate to the Swagger UI URL, wait for JS rendering, " +
      "and assert that at least one operation block is visible."
  )
  public void swaggerUiPage_loadsAndShowsEndpoints() {
    SwaggerUiPage page = new SwaggerUiPage(driver);
    page.open();

    assertTrue(page.isLoaded(),
        "Swagger UI did not render any operation blocks — " +
        "the JS bundle may have failed to load or the spec URL returned an error.");

    int endpointCount = page.getEndpointCount();
    assertTrue(endpointCount > 0,
        "Expected at least 1 endpoint block, but found " + endpointCount);

    System.out.printf("   ✓  Swagger UI rendered %d endpoint blocks%n", endpointCount);
  }

  /**
   * Verify the API title displayed in Swagger UI is not empty.
   * An empty title indicates the spec loaded but is missing the {@code info.title} field.
   */
  @Test(groups = {"smoke", "selenium"})
  @Severity(SeverityLevel.CRITICAL)
  @Story("API title is rendered")
  @Description("The Swagger UI header must display a non-empty API title from the spec.")
  public void swaggerUiPage_displaysApiTitle() {
    SwaggerUiPage page = new SwaggerUiPage(driver);
    page.open();

    String title = page.getApiTitle();
    assertNotNull(title, "API title element was null");
    assertFalse(title.isBlank(), "API title was blank — check the spec info.title field");

    System.out.printf("   ✓  API title: \"%s\"%n", title);
  }

  /**
   * Verify that GET endpoints are rendered.
   * A well-formed REST API should document at least one GET operation.
   */
  @Test(groups = {"contract", "selenium"})
  @Severity(SeverityLevel.NORMAL)
  @Story("GET operations are documented")
  @Description("Swagger UI must render at least one GET operation block.")
  public void swaggerUiPage_hasGetEndpoints() {
    SwaggerUiPage page = new SwaggerUiPage(driver);
    page.open();

    int getCount = page.getEndpointCountByMethod("GET");
    assertTrue(getCount > 0,
        "Expected at least one GET operation block, found " + getCount);

    System.out.printf("   ✓  Found %d GET endpoints%n", getCount);
  }

  /**
   * Verify that POST endpoints are rendered.
   * Confirms create operations are documented in the spec.
   */
  @Test(groups = {"contract", "selenium"})
  @Severity(SeverityLevel.NORMAL)
  @Story("POST operations are documented")
  @Description("Swagger UI must render at least one POST operation block.")
  public void swaggerUiPage_hasPostEndpoints() {
    SwaggerUiPage page = new SwaggerUiPage(driver);
    page.open();

    int postCount = page.getEndpointCountByMethod("POST");
    assertTrue(postCount > 0,
        "Expected at least one POST operation block, found " + postCount);

    System.out.printf("   ✓  Found %d POST endpoints%n", postCount);
  }
}
