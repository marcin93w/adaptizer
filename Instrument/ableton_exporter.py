from pywinauto import Application
import time

class AbletonExporter:
    def export(self, full_path):
        try:
            max_retries = 3
            retry_delay = 1
            
            for attempt in range(max_retries):
                try:
                    self.app = Application().connect(title_re=".*Ableton Live.*", timeout=5)
                    break
                except Exception:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                    else:
                        raise RuntimeError("Could not connect to Ableton Live. Please ensure that:\n"
                                         "1. Ableton Live is running\n"
                                         "2. A project is open\n"
                                         "3. The Ableton window is not minimized")

            self.main_window = self.app.window(title_re=".*Ableton Live.*")
            if not self.main_window.is_visible():
                raise RuntimeError("Ableton Live window is not visible. Please restore the window.")

            time.sleep(0.5)
            
            self.main_window.type_keys('^+r')
            
            time.sleep(0.5)
            
            export_dialog = self.app.window(title="Export Audio/Video")
            export_dialog.type_keys('{ENTER}')
            
            time.sleep(1)
            
            save_dialog = self.app.window(title="Save Audio File As:")
            save_dialog.wait('ready', timeout=10)
            
            save_dialog.Edit.set_text(full_path)
            time.sleep(0.5)
            
            save_dialog.Save.click()
            time.sleep(0.5)
            
        except Exception as e:
            if "Could not connect to Ableton Live" in str(e):
                raise
            raise RuntimeError("Error while trying to export project. Make sure Ableton Live is running and responsive.") from e
