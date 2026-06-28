package com.swaggerpilot.selenium.pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.List;

/**
 * SwaggerUiPage — Page Object Model for the Swagger UI HTML page.
 *
 * <p>Encapsulates all element locators and interactions for the Swagger UI
 * documentation page. Tests should never contain raw selectors — all DOM
 * knowledge belongs in this class.
 *
 * <h3>Page Object Model (POM) contract</h3>
 * <ul>
 *   <li>Each meaningful user interaction is a public method (verb).</li>
 *   <li>Raw {@code WebElement} fields are kept package-private or private.</li>
 *   <li>Waits live here, not in the test — tests stay readable.</li>
 *   <li>A page method should return {@code this} or a new page object when
 *       navigation occurs, enabling the fluent builder pattern in tests.</li>
 * </ul>
 *
 * <h3>Example usage in a test</h3>
 * <pre>{@code
 * SwaggerUiPage page = new SwaggerUiPage(driver);
 * page.open();
 * assertTrue(page.isLoaded());
 * assertTrue(page.getEndpointCount() > 0);
 * }</pre>
 */
public class SwaggerUiPage {

  private final WebDriver driver;
  private final WebDriverWait wait;

  /** Swagger UI title element — present once the page fully loads. */
  @FindBy(css = ".swagger-ui .title")
  private WebElement apiTitle;

  /** Each block represents one HTTP operation (GET, POST, etc.). */
  @FindBy(css = ".opblock")
  private List<WebElement> operationBlocks;

  /** The expand/collapse all operations button. */
  @FindBy(css = ".expand-operation")
  private List<WebElement> expandButtons;

  // URLs
  private static final String SWAGGER_UI_URL =
      System.getenv().getOrDefault("SWAGGER_UI_URL", "https://petstore.swagger.io");

  /**
   * Construct the page object and initialise {@link PageFactory} element annotations.
   *
   * @param driver an already-opened {@link WebDriver} instance
   */
  public SwaggerUiPage(WebDriver driver) {
    this.driver  = driver;
    this.wait    = new WebDriverWait(driver, Duration.ofSeconds(15));
    PageFactory.initElements(driver, this);
  }

  /**
   * Navigate to the Swagger UI page and wait for it to fully render.
   *
   * @return {@code this} for method chaining
   */
  public SwaggerUiPage open() {
    driver.get(SWAGGER_UI_URL);
    // Wait for at least one operation block to be present — the JS bundle
    // renders these asynchronously after page load.
    wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector(".opblock")));
    return this;
  }

  /**
   * Check whether the Swagger UI page has finished loading.
   * A page is considered loaded when at least one API endpoint block is visible.
   *
   * @return {@code true} if the page content is visible
   */
  public boolean isLoaded() {
    try {
      return !driver.findElements(By.cssSelector(".opblock")).isEmpty();
    } catch (Exception e) {
      return false;
    }
  }

  /**
   * Count the number of HTTP operation blocks rendered on the page.
   * Each block corresponds to one API endpoint documented in the spec.
   *
   * @return the total number of operation blocks visible
   */
  public int getEndpointCount() {
    return driver.findElements(By.cssSelector(".opblock")).size();
  }

  /**
   * Read the API title from the Swagger UI header.
   *
   * @return the title text (e.g. "Swagger Petstore")
   */
  public String getApiTitle() {
    return wait
        .until(ExpectedConditions.visibilityOf(apiTitle))
        .getText();
  }

  /**
   * Count the number of distinct HTTP method types rendered on the page.
   * Uses the CSS colour classes Swagger UI assigns per method
   * (e.g. {@code .opblock-get}, {@code .opblock-post}).
   *
   * @param method uppercase HTTP method, e.g. "GET", "POST"
   * @return count of operation blocks for that method
   */
  public int getEndpointCountByMethod(String method) {
    String cssClass = ".opblock-" + method.toLowerCase();
    return driver.findElements(By.cssSelector(cssClass)).size();
  }

  /**
   * Return the current page title as set by the browser (the HTML {@code <title>} tag).
   *
   * @return browser window title string
   */
  public String getPageTitle() {
    return driver.getTitle();
  }
}
