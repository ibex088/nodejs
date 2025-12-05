# Kubernetes Deployment for Cal.com API v2

## Prerequisites

1. EKS cluster created via Terraform
2. kubectl configured to access the cluster
3. Helm installed

## Setup

### 1. Configure kubectl

```bash
# Get command from Terraform output
terraform output configure_kubectl
# Run the output command, e.g.:
aws eks update-kubeconfig --region ap-south-1 --name calcom-eks
```

### 2. Install AWS Load Balancer Controller

```bash
# Get the full command from Terraform output
terraform output install_aws_lb_controller

# Or manually:
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=calcom-eks \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=<ROLE_ARN_FROM_TERRAFORM>
```

### 3. Update secrets.yaml

Replace placeholder values with actual outputs from Terraform:
```bash
terraform output rds_endpoint        # For DATABASE_URL
terraform output redis_endpoint      # For REDIS_URL
```

Generate random strings for auth secrets:
```bash
openssl rand -base64 32  # For NEXTAUTH_SECRET, JWT_SECRET, etc.
```

### 4. Update ingress.yaml

Replace subnet IDs with output from Terraform:
```bash
terraform output public_subnet_ids
```

### 5. Deploy

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6. Verify

```bash
# Check pods
kubectl get pods -n calcom

# Check HPA
kubectl get hpa -n calcom

# Check ingress (ALB created by K8s)
kubectl get ingress -n calcom

# Get ALB URL
kubectl get ingress -n calcom -o jsonpath='{.items[0].status.loadBalancer.ingress[0].hostname}'

# Check logs
kubectl logs -n calcom -l app=calcom-api --tail=100
```

## Useful Commands

```bash
# Scale manually
kubectl scale deployment calcom-api -n calcom --replicas=5

# Restart deployment (rolling update)
kubectl rollout restart deployment calcom-api -n calcom

# Check rollout status
kubectl rollout status deployment calcom-api -n calcom

# Rollback
kubectl rollout undo deployment calcom-api -n calcom

# Port forward for local testing
kubectl port-forward -n calcom svc/calcom-api 8080:80
```

## Architecture

```
Internet
    │
    ▼
┌─────────┐
│   ALB   │  (Public Subnet - created by K8s Ingress)
└────┬────┘
     │
     ▼
┌─────────────────────────────────────┐
│         EKS Cluster                  │  (Private Subnet)
│  ┌─────────┐  ┌─────────┐           │
│  │   Pod   │  │   Pod   │  ...      │
│  │ API v2  │  │ API v2  │           │
│  └────┬────┘  └────┬────┘           │
└───────┼────────────┼────────────────┘
        │            │
        ▼            ▼
┌──────────────┐  ┌──────────────┐
│     RDS      │  │    Redis     │  (Private Subnet)
│   Postgres   │  │  ElastiCache │
└──────────────┘  └──────────────┘
```
