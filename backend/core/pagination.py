from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.db.models import Sum

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        try:
            queryset = self.page.paginator.object_list
            total_amount = queryset.aggregate(total=Sum('amount'))['total'] or 0
            response.data['total_amount'] = float(total_amount)
        except Exception:
            pass
        return response
