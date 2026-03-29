const Joi = require('joi');
const {
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
  COMPLAINT_PRIORITIES,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  LOCATION_MIN_LENGTH,
  LOCATION_MAX_LENGTH,
  IMAGE_BASE64_MAX_LENGTH,
  REMARK_MAX_LENGTH,
  ESCALATION_REASON_MAX_LENGTH,
  PROOF_URL_MAX_LENGTH
} = require('../constants/validation');

const complaintSchemas = {
  createComplaint: Joi.object({
    category: Joi.string().trim().valid(...COMPLAINT_CATEGORIES).required(),
    description: Joi.string().trim().min(DESCRIPTION_MIN_LENGTH).max(DESCRIPTION_MAX_LENGTH).required(),
    location: Joi.string().trim().min(LOCATION_MIN_LENGTH).max(LOCATION_MAX_LENGTH).required(),
    image: Joi.string().max(IMAGE_BASE64_MAX_LENGTH).optional(),
    imageName: Joi.string().trim().pattern(/\.(jpg|jpeg|png|gif)$/i).when('image', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }).unknown(false),

  updateStatus: Joi.object({
    status: Joi.string().valid(...COMPLAINT_STATUSES).required()
  }).unknown(false),

  addRemark: Joi.object({
    remark_text: Joi.string().trim().min(1).max(REMARK_MAX_LENGTH).required()
  }).unknown(false),

  uploadResolveProof: Joi.object({
    proof_url: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(PROOF_URL_MAX_LENGTH).required()
  }).unknown(false),

  assignComplaint: Joi.object({
    admin_id: Joi.number().integer().positive().required()
  }).unknown(false),

  overridePriority: Joi.object({
    new_priority: Joi.string().valid(...COMPLAINT_PRIORITIES).required()
  }).unknown(false),

  escalationReason: Joi.object({
    reason: Joi.string().trim().min(5).max(ESCALATION_REASON_MAX_LENGTH).required()
  }).unknown(false)
};

module.exports = complaintSchemas;
