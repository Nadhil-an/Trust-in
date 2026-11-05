from django.apps import AppConfig


class HrModuleConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'hr_module'

    def ready(self):
        import hr_module.signals  # noqa: F401
