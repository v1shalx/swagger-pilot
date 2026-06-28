package com.swaggerpilot.base;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;

import java.lang.reflect.Method;
import java.time.Duration;

/**
 * BaseSeleniumTest — abstract parent for all Selenium / browser tests.
 *
 * <p>Manages the {@link WebDriver} lifecycle: creates a headless Chrome instance
 * before each test and quits it afterward. Using per-method teardown (rather
 * than per-class) prevents a failing test from leaving a zombie browser
 * process that corrupts subsequent tests.
 *
 * <h3>Why headless?</h3>
 * Headless Chrome has no GUI dependency, so tests run identically in a
 * local terminal, Docker container, or Jenkins agent.
 *
 * <h3>Why WebDriverManager?</h3>
 * {@code WebDriverManager.chromedriver().setup()} downloads the matching
 * ChromeDriver binary automatically — no manual PATH configuration required
 * on dev machines or CI agents.
 */
public abstract class BaseSeleniumTest {

  /**
   * The browser instance for this test. Each test method gets its own driver
   * so tests are fully isolated with no shared browser state.
   */
  protected WebDriver driver;

  /**
   * Default implicit wait applied to every {@code findElement} call.
   * Keep this low — explicit waits on specific elements are preferable.
   */
  private static final Duration IMPLICIT_WAIT = Duration.ofSeconds(5);

  /**
   * Page load timeout — fail fast if the server is down rather than hanging.
   */
  private static final Duration PAGE_LOAD_TIMEOUT = Duration.ofSeconds(20);

  /**
   * Initialise a headless Chrome {@link WebDriver} before each test method.
   * WebDriverManager resolves and caches the correct ChromeDriver version.
   *
   * @param method the TestNG method about to run — used for log output only
   */
  @BeforeMethod(alwaysRun = true)
  public void initDriver(Method method) {
    System.out.printf("%n▶  [Selenium] %s.%s%n", getClass().getSimpleName(), method.getName());

    WebDriverManager.chromedriver().setup();

    ChromeOptions options = new ChromeOptions();
    options.addArguments(
        "--headless=new",          // New headless mode (Chrome 112+)
        "--no-sandbox",            // Required in Docker / CI environments
        "--disable-dev-shm-usage", // Prevents /dev/shm exhaustion in containers
        "--window-size=1920,1080"  // Fixed viewport so element coordinates are stable
    );

    driver = new ChromeDriver(options);
    driver.manage().timeouts().implicitlyWait(IMPLICIT_WAIT);
    driver.manage().timeouts().pageLoadTimeout(PAGE_LOAD_TIMEOUT);
  }

  /**
   * Quit the browser after each test method, regardless of pass/fail status.
   * {@code alwaysRun = true} ensures teardown runs even when {@link BeforeMethod}
   * throws, avoiding orphaned Chrome processes.
   */
  @AfterMethod(alwaysRun = true)
  public void quitDriver() {
    if (driver != null) {
      driver.quit();
      driver = null;
    }
  }
}
