// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HelloWorldApp",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .executableTarget(
            name: "HelloWorldApp",
            path: "Sources"
        )
    ]
)
