import SwiftUI

@main
struct HelloWorldApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(spacing: 20) {
                Image(systemName: "globe")
                    .imageScale(.large)
                    .foregroundColor(.accentColor)
                    .font(.system(size: 60))
                
                Text("Hello, World!")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("This is Remote-to-Native Mac Dev.")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }
            .padding(50)
            .background(Color.black)
            .colorScheme(.dark)
        }
        .windowStyle(HiddenTitleBarWindowStyle())
    }
}
