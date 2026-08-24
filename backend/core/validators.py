from django.core.exceptions import ValidationError

def validate_image_file(image):
    max_size_mb = 10
    if image.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f"Image must be under {max_size_mb}MB.")
    
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if hasattr(image, 'content_type') and image.content_type not in allowed_types:
        raise ValidationError(f"Unsupported file type: {image.content_type}. Only JPEG, PNG, WebP, GIF are allowed.")


def validate_document_file(doc):
    max_size_mb = 10
    if doc.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f"Document must be under {max_size_mb}MB.")
    
    allowed_types = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp'
    ]
    if hasattr(doc, 'content_type') and doc.content_type not in allowed_types:
        raise ValidationError(f"Unsupported file type: {doc.content_type}. Only PDF, DOC/DOCX, or Images are allowed.")
