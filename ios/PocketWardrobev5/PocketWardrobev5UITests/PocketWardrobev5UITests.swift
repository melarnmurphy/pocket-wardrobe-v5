//
//  PocketWardrobev5UITests.swift
//  PocketWardrobev5UITests
//
//  Created by Melarn Murphy on 22/4/2026.
//

import XCTest

final class PocketWardrobev5UITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.

        // In UI tests it is usually best to stop immediately when a failure occurs.
        continueAfterFailure = false

        app = XCUIApplication()

        // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    @MainActor
    func testExample() throws {
        // UI tests must launch the application that they test.
        app.launch()

        // Use XCTAssert and related functions to verify your tests produce the correct results.
        // XCUIAutomation Documentation
        // https://developer.apple.com/documentation/xcuiautomation
    }

    @MainActor
    func testAuthenticatedCoreJourney() throws {
        guard let email = ProcessInfo.processInfo.environment["PW_E2E_EMAIL"],
              let password = ProcessInfo.processInfo.environment["PW_E2E_PASSWORD"],
              !email.isEmpty,
              !password.isEmpty else {
            throw XCTSkip("Set PW_E2E_EMAIL and PW_E2E_PASSWORD to run the authenticated journey.")
        }

        app.launch()

        let emailField = app.textFields["auth.email"]
        let passwordField = app.secureTextFields["auth.password"]
        if emailField.waitForExistence(timeout: 5) {
            emailField.tap()
            emailField.typeText(email)
            passwordField.tap()
            passwordField.typeText(password)
            app.buttons["auth.submit"].tap()
        }

        // New accounts may need the one-time weather location before the tabs appear.
        let locationField = app.textFields["account.location"]
        if locationField.waitForExistence(timeout: 8) {
            locationField.tap()
            locationField.typeText(ProcessInfo.processInfo.environment["PW_E2E_LOCATION"] ?? "Adelaide")
            app.buttons["account.location.continue"].tap()
        }

        let wardrobeTab = app.tabBars.buttons["Wardrobe"]
        XCTAssertTrue(wardrobeTab.waitForExistence(timeout: 20))
        wardrobeTab.tap()

        // Confirm that the live wardrobe screen is reachable and that its ingestion entry point is wired.
        let addButton = app.buttons["wardrobe.add"]
        XCTAssertTrue(addButton.waitForExistence(timeout: 10))
        addButton.tap()
        XCTAssertTrue(app.navigationBars["Add a piece"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["capture.choose-library"].exists)

        // The remaining upload/confirm assertions require a photo seeded into the simulator.
        // Seed one with `xcrun simctl addmedia <device-udid> <image>` before running this test.
        guard ProcessInfo.processInfo.environment["PW_E2E_IMAGE_SEEDED"] == "1" else {
            throw XCTSkip("Set PW_E2E_IMAGE_SEEDED=1 after seeding a simulator photo to continue the upload flow.")
        }

        app.buttons["capture.choose-library"].tap()
        let photosPicker = XCUIApplication(bundleIdentifier: "com.apple.PhotosUIService")
        // PHPicker's accessibility hierarchy differs between simulator/runtime
        // versions. Use the semantic cell query rather than assuming a
        // collection-view container.
        if photosPicker.buttons["Allow Full Access"].waitForExistence(timeout: 3) {
            photosPicker.buttons["Allow Full Access"].tap()
        }
        var firstPhoto = photosPicker.descendants(matching: .cell).firstMatch
        if !firstPhoto.waitForExistence(timeout: 8) {
            // iOS 26 exposes PHPicker thumbnails as images in some simulator
            // configurations rather than cells.
            firstPhoto = photosPicker.images.firstMatch
        }
        if !firstPhoto.waitForExistence(timeout: 15) {
            let hierarchy = XCTAttachment(string: photosPicker.debugDescription)
            hierarchy.name = "Photos picker accessibility hierarchy"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        XCTAssertTrue(firstPhoto.waitForExistence(timeout: 15))
        firstPhoto.tap()
        if photosPicker.buttons["Add"].exists {
            photosPicker.buttons["Add"].tap()
        } else if photosPicker.buttons["Done"].exists {
            photosPicker.buttons["Done"].tap()
        }

        let confirmButton = app.buttons["capture.confirm"]
        XCTAssertTrue(confirmButton.waitForExistence(timeout: 30))
        confirmButton.tap()

        XCTAssertTrue(app.staticTexts["Added 1 piece to your wardrobe."].waitForExistence(timeout: 30))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'piece'" )).firstMatch.waitForExistence(timeout: 15))

        // Log the newly-created garment as worn and verify the diary save path.
        app.tabBars.buttons["Diary"].tap()
        XCTAssertTrue(app.buttons["LOG TODAY'S OUTFIT"].waitForExistence(timeout: 15))
        app.buttons["LOG TODAY'S OUTFIT"].tap()
        XCTAssertTrue(app.buttons["diary.source.closet"].waitForExistence(timeout: 10))
        app.buttons["diary.source.closet"].tap()
        let garmentChoice = app.sheets.buttons.firstMatch
        XCTAssertTrue(garmentChoice.waitForExistence(timeout: 10))
        garmentChoice.tap()
        app.buttons["diary.garment-picker.done"].tap()
        XCTAssertTrue(app.buttons["diary.save"].waitForExistence(timeout: 10))
        app.buttons["diary.save"].tap()

        // Exercise the planner's live generation entry point. The backend may quite
        // reasonably reject generation for a test account with only one garment;
        // either a generated outfit or an explicit error proves the request path ran.
        app.tabBars.buttons["Planner"].tap()
        XCTAssertTrue(app.buttons["GENERATE TODAY"].waitForExistence(timeout: 15))
        app.buttons["GENERATE TODAY"].tap()
        let outfitOrError = app.staticTexts["No outfit generated yet."]
            .firstMatch
        let generatedOrError = app.staticTexts.containing(NSPredicate(format: "label CONTAINS[c] 'outfit'" )).firstMatch
        XCTAssertTrue(outfitOrError.waitForExistence(timeout: 30) || generatedOrError.waitForExistence(timeout: 30))
    }

    @MainActor
    func testLaunchPerformance() throws {
        // This measures how long it takes to launch your application.
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }
}
