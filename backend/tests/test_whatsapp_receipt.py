from django.test import TestCase
from notify.whatsapp_service import sanitize_phone_number, send_whatsapp_receipt
from accounts_module.models import Income, IncomeSource, PaymentMethod
import datetime


class WhatsAppReceiptTestCase(TestCase):
    def test_phone_sanitization(self):
        self.assertEqual(sanitize_phone_number("9876543210"), "919876543210")
        self.assertEqual(sanitize_phone_number("+91 98765 43210"), "919876543210")
        self.assertEqual(sanitize_phone_number(""), "")

    def test_income_creation_with_phone(self):
        income = Income.objects.create(
            donor_name="Test Donor",
            donor_phone="9876543210",
            source=IncomeSource.DONATION,
            amount=1000.00,
            payment_method=PaymentMethod.CASH,
            purpose="General Charity"
        )
        self.assertEqual(income.donor_phone, "9876543210")
        self.assertTrue(income.receipt_number.startswith("RCP-"))

    def test_member_certificate_generation(self):
        from hr_module.models import Member, MembershipType
        from hr_module.member_receipt_service import generate_member_certificate_html
        member = Member.objects.create(
            full_name="Nadhil Member",
            phone="9876543210",
            membership_type=MembershipType.LIFE
        )
        html = generate_member_certificate_html(member)
        self.assertIn("Nadhil Member", html)
        self.assertIn(member.member_id, html)
        self.assertIn("MEMBERSHIP RECEIPT", html)

    def test_member_pdf_bytes_generation(self):
        from hr_module.models import Member, MembershipType
        from hr_module.member_pdf_generator import generate_member_receipt_pdf_bytes
        member = Member.objects.create(
            full_name="PDF Member",
            phone="9876543210",
            membership_type=MembershipType.GENERAL
        )
        pdf_bytes = generate_member_receipt_pdf_bytes(member)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    def test_member_image_bytes_generation(self):
        from hr_module.models import Member, MembershipType
        from hr_module.member_image_generator import generate_member_receipt_image_bytes
        member = Member.objects.create(
            full_name="Image Member",
            phone="9876543210",
            membership_type=MembershipType.GENERAL
        )
        img_bytes = generate_member_receipt_image_bytes(member, receipt_number="SLCT/2026/000099", membership_id="SLCT/MEM/000099", amount=100.0)
        self.assertTrue(len(img_bytes) > 100)
