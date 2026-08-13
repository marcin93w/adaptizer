pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

// The standalone build of the shared Kotlin library. The React Native host
// (mobile/android) includes :adaptive-audio from its own settings file; this
// build exists so `./gradlew :adaptive-audio:test` runs the library's JVM
// tests without Node or the RN toolchain.
rootProject.name = "AdaptizerPlayer"
include(":adaptive-audio")
