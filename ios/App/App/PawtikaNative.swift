import UIKit
import Capacitor
import GameKit

/* The two things 1.5 needed from iOS that no installed plugin offers:
   Game Center (sign-in, leaderboards) and a copy of the save in iCloud's
   key-value store, so a player who changes phone or reinstalls gets their
   game back on the same Apple ID.

   Registered by PawtikaViewController below, which SceneDelegate uses in
   place of the plain CAPBridgeViewController. The page reaches it as
   Capacitor.Plugins.PawtikaNative (src/js/54-native.js). Nothing here
   throws to the page: every call resolves, with ok false when it could
   not do the thing, because a game that waits on Game Center to start a
   level is worse than one without it. */
@objc(PawtikaNativePlugin)
public class PawtikaNativePlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "PawtikaNativePlugin"
    public let jsName = "PawtikaNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "gcSignIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gcSubmitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "gcShow", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cloudSet", returnType: CAPPluginReturnPromise)
    ]

    /* GameKit calls the handler more than once: with a sign-in screen to
       show, then with the outcome. The call is answered once. */
    @objc func gcSignIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let player = GKLocalPlayer.local
            if player.isAuthenticated {
                call.resolve(["ok": true])
                return
            }
            var answered = false
            player.authenticateHandler = { [weak self] controller, error in
                if let controller = controller {
                    DispatchQueue.main.async {
                        self?.bridge?.viewController?.present(controller, animated: true)
                    }
                    return
                }
                if answered { return }
                answered = true
                call.resolve(["ok": GKLocalPlayer.local.isAuthenticated,
                              "error": error?.localizedDescription ?? ""])
            }
        }
    }

    @objc func gcSubmitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        let board = call.getString("board") ?? ""
        let score = call.getInt("score") ?? 0
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [board]) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func gcShow(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let board = call.getString("board") ?? ""
            let controller: GKGameCenterViewController
            if board.isEmpty {
                controller = GKGameCenterViewController(state: .leaderboards)
            } else {
                controller = GKGameCenterViewController(leaderboardID: board, playerScope: .global, timeScope: .allTime)
            }
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve(["ok": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    /* iCloud key-value store: one key, the save as the page writes it.
       A megabyte per app; a save is tens of kilobytes. */
    @objc func cloudGet(_ call: CAPPluginCall) {
        let store = NSUbiquitousKeyValueStore.default
        store.synchronize()
        if let value = store.string(forKey: call.getString("key") ?? "save") {
            call.resolve(["has": true, "value": value])
        } else {
            call.resolve(["has": false])
        }
    }

    @objc func cloudSet(_ call: CAPPluginCall) {
        let store = NSUbiquitousKeyValueStore.default
        store.set(call.getString("value") ?? "", forKey: call.getString("key") ?? "save")
        call.resolve(["ok": store.synchronize()])
    }
}

/* The bridge, with the plugin above handed to it once it is up. */
class PawtikaViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PawtikaNativePlugin())
    }
}
