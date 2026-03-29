-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: scrs
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `complaints`
--

DROP TABLE IF EXISTS `complaints`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `complaints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(50) DEFAULT NULL,
  `description` text,
  `location` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `priority` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `complaints`
--

LOCK TABLES `complaints` WRITE;
/*!40000 ALTER TABLE `complaints` DISABLE KEYS */;
INSERT INTO `complaints` VALUES (1,'Road','Test pothole','Main Street','Submitted','Medium','2026-02-03 11:21:51'),(2,'Garbage','Garbage bins in the area are overflowing and have not been cleared for the past three days. The smell is spreading, and stray animals are scattering waste across the road. Request immediate cleaning and regular maintenance.\n','Street No. 5, Near Community Park, Narsapur','Submitted','Medium','2026-02-03 11:29:24'),(3,'Garbage','Smart Complaint Resolution System (CivicTech)\n\nDomain: Smart Cities\n','Narsapur, Telangana, India','Submitted','Medium','2026-02-03 11:52:23'),(4,'Garbage','fgdsh','Narsapur, Telangana, India','Submitted','Medium','2026-02-03 11:59:01'),(5,'Login issue','Unable to log in with correct credentials.','Website login page','Submitted','High','2026-02-03 13:43:03'),(6,'Garbage','there is problem','Narsapur, Telangana, India','Submitted','Medium','2026-02-03 17:36:36'),(7,'Water','water probs',' Street No. 5, Near Community Park, Knr','Submitted','Medium','2026-02-03 17:47:10'),(8,'Garbage','hi','Narsapur, Telangana, India','Submitted','High','2026-02-03 18:52:19'),(9,'Garbage','gargabe at','Street No. 5, Near Community Park, Narsapur','Submitted','High','2026-02-03 18:59:05'),(10,'Garbage','get ww','Narsapur, Telangana, India','Submitted','High','2026-02-03 19:03:00'),(11,'Water','flood',' Street No. 5, Near Community Park, Knr','Submitted','High','2026-02-03 19:42:15'),(12,'Water','flood','karimnagar','Submitted','High','2026-02-03 19:43:38'),(13,'Electricity','Street lights have been non-functional for the past week, making the area unsafe at night.\n','bvrit main gate','Submitted','High','2026-02-03 19:46:24'),(14,'Electricity','Street lights have been non-functional for the past week, making the area unsafe at night.\n','Near BVRIT College Main Gate','Submitted','High','2026-02-03 19:51:31'),(15,'Streetlight','Streetlight problem at woxen campus gate','Kamkole ,Sadasivapet, Telangana','Submitted','High','2026-02-03 19:55:06'),(16,'Streetlight',' Street lights have been non-functional for the past week, making the area unsafe at night.',' Near BVRIT College Main Gat','Submitted','High','2026-02-03 19:58:04'),(17,'Streetlight',' Street lights have been non-functional for the past week, making the area unsafe at night.','Narsapur, Telangana, India','Submitted','Medium','2026-02-03 19:59:10'),(18,'Streetlight',' Street lights have been non-functional for the past week, making the area unsafe at night.',' Street No. 5, Near Community Park, Narsapur','Submitted','High','2026-02-03 20:00:08'),(19,'Streetlight',' Street lights have been non-functional for the past week, making the area unsafe at night.','Street No. 5, Near Community Park, Narsapur','Submitted','High','2026-02-03 20:00:18'),(20,'Water','Tap water has been unavailable since yesterday evening. Residents are facing difficulty in cooking and drinking.\n','manikonda ,hyderabad ,Telangana','Submitted','Medium','2026-02-03 20:05:21'),(21,'Road','Test complaint','Test location','Submitted','Medium','2026-02-03 20:07:41'),(22,'Garbage','ap water has been unavailable since yesterday evening. Residents are facing difficulty in cooking and drinking.\n',' Street No. 5, Near Community Park, Knr','Submitted','Medium','2026-02-03 20:36:38'),(23,'Garbage','Garbage bins are overflowing and have not been cleared for three days. The smell is spreading and stray animals are scattering waste.\n','uppal,hyderabad','Submitted','Medium','2026-02-03 20:44:53'),(24,'Garbage','Garbage bins are overflowing and have not been cleared for three days. The smell is spreading and stray animals are scattering waste.','warangal,telangana','Submitted','Medium','2026-02-03 21:08:44');
/*!40000 ALTER TABLE `complaints` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-04  2:44:17
